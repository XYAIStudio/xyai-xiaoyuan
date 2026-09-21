import type { AgentSummary, ChatMessage } from "../types";
import type {
  BackendProvider,
  ConnectionTestResult,
  ProviderContext,
  SendChatHandle,
  SendChatInput,
} from "./types";
import { runConnectionTest } from "./connection";
import { describeProviderError } from "./errors";
import {
  displayNameOf,
  FREEOS_DEFAULT_URL,
  FREEOS_PATHS,
  isSetupRequired,
  loginTokenOf,
} from "./freeosPaths";
import {
  apiJson,
  extractTextContent,
  normalizeBaseUrl,
  ProviderHttpError,
} from "./http";

const TOKEN_KEY = "freeos_token";
const PASSWORD_KEY = "freeos_password";

async function storedToken(ctx: ProviderContext): Promise<string | null> {
  const token = (await ctx.getSecret(TOKEN_KEY))?.trim();
  return token || null;
}

async function login(ctx: ProviderContext): Promise<{ access_token: string }> {
  const password = await ctx.getSecret(PASSWORD_KEY);
  if (!ctx.username?.trim() || !password) {
    throw new Error(
      "请先在设置中填写 FreeOS 用户名和密码，或粘贴本机已登录桌面的 auth_token（无密码可直接复用）",
    );
  }
  const result = await apiJson<Record<string, unknown>>(
    ctx.baseUrl,
    FREEOS_PATHS.login,
    {
      method: "POST",
      body: JSON.stringify({ username: ctx.username.trim(), password }),
    },
  );
  const access_token = loginTokenOf(result);
  if (!access_token) {
    throw new Error("登录响应缺少 access_token");
  }
  await ctx.setSecret(TOKEN_KEY, access_token);
  return { access_token };
}

/** Prefer a stored Bearer token (desktop FreeOS `auth_token`); login only if needed. */
async function resolveAccessToken(
  ctx: ProviderContext,
): Promise<{ token: string; profile?: Record<string, unknown> }> {
  const existing = await storedToken(ctx);
  if (existing) {
    try {
      const profile = await apiJson<Record<string, unknown>>(
        ctx.baseUrl,
        FREEOS_PATHS.me,
        { token: existing },
      );
      return { token: existing, profile };
    } catch (error) {
      if (!(error instanceof ProviderHttpError) || error.status !== 401) {
        throw error;
      }
      await ctx.deleteSecret(TOKEN_KEY);
    }
  }
  const { access_token } = await login(ctx);
  return { token: access_token };
}

async function withToken<T>(
  ctx: ProviderContext,
  operation: (token: string) => Promise<T>,
): Promise<T> {
  let token = await storedToken(ctx);
  if (!token) {
    token = (await login(ctx)).access_token;
  }
  try {
    return await operation(token);
  } catch (error) {
    if (!(error instanceof ProviderHttpError) || error.status !== 401) {
      throw error;
    }
    await ctx.deleteSecret(TOKEN_KEY);
    token = (await login(ctx)).access_token;
    return await operation(token);
  }
}

async function apiJsonWithFallback<T>(
  ctx: ProviderContext,
  token: string,
  primary: string,
  fallback: string,
  init: RequestInit = {},
): Promise<T> {
  try {
    return await apiJson<T>(ctx.baseUrl, primary, { ...init, token });
  } catch (error) {
    if (error instanceof ProviderHttpError && error.status === 404) {
      return apiJson<T>(ctx.baseUrl, fallback, { ...init, token });
    }
    throw error;
  }
}

async function createThread(
  ctx: ProviderContext,
  agentId: string,
): Promise<{ threadId: string; sessionKey?: string }> {
  return withToken(ctx, (token) =>
    apiJsonWithFallback<{ thread_id: string; session_key?: string }>(
      ctx,
      token,
      FREEOS_PATHS.createThread(agentId),
      FREEOS_PATHS.createSession(agentId),
      { method: "POST" },
    ).then((created) => ({
      threadId: created.thread_id,
      sessionKey: created.session_key,
    })),
  );
}

export function buildSubscribeFrame(threadId: string): {
  type: "subscribe";
  thread_id: string;
} {
  return { type: "subscribe", thread_id: threadId };
}

export function buildUserTurnFrame(input: {
  text: string;
  threadId: string;
  sessionKey: string;
}): {
  type: "user_turn";
  text: string;
  session_key: string;
  thread_id: string;
  messages: Array<{ role: "user"; content: string }>;
} {
  return {
    type: "user_turn",
    text: input.text,
    session_key: input.sessionKey,
    thread_id: input.threadId,
    messages: [{ role: "user", content: input.text }],
  };
}

export function buildCancelFrame(threadId: string): {
  type: "cancel";
  thread_id: string;
} {
  return { type: "cancel", thread_id: threadId };
}

export function buildPingFrame(): { type: "ping" } {
  return { type: "ping" };
}

type FreeOsWsChunk = {
  type?: string;
  content?: string;
  text?: string;
  message?: string;
  error?: string;
  active?: boolean;
  done?: boolean;
};

export function streamDeltaOf(chunk: FreeOsWsChunk): string {
  if (chunk.type !== "token" && chunk.type !== "text" && chunk.type !== "delta") {
    return "";
  }
  if (typeof chunk.content === "string" && chunk.content) return chunk.content;
  if (typeof chunk.text === "string" && chunk.text) return chunk.text;
  return "";
}

export function streamErrorOf(chunk: FreeOsWsChunk): string {
  if (typeof chunk.message === "string" && chunk.message.trim()) {
    return chunk.message.trim();
  }
  if (typeof chunk.error === "string" && chunk.error.trim()) {
    return chunk.error.trim();
  }
  if (typeof chunk.content === "string" && chunk.content.trim()) {
    return chunk.content.trim();
  }
  return "流式错误";
}

export function formatFreeOsStreamError(message: string): string {
  const text = message.trim() || "流式错误";
  if (/模型调用/.test(text)) {
    return `${text}（这是 FreeOS 的模型/供应商配置问题，不是小元连接失败）`;
  }
  return text;
}

async function resolveThreadSession(
  ctx: ProviderContext,
  input: SendChatInput,
): Promise<{ threadId: string; sessionKey: string }> {
  if (input.threadId && input.sessionKey) {
    return { threadId: input.threadId, sessionKey: input.sessionKey };
  }
  const created = await createThread(ctx, input.agentId);
  const threadId = created.threadId || input.threadId;
  const sessionKey = created.sessionKey || input.sessionKey;
  if (!threadId || !sessionKey) {
    throw new Error("FreeOS 创建会话未返回 thread_id / session_key");
  }
  return { threadId, sessionKey };
}

/**
 * Live FreeOS `GET /api/agents` returns both numeric `id` and string `agent_id`
 * (e.g. `main`). Every agent-scoped route (`/agents/{id}/threads`, chat WS)
 * must use the string `agent_id`, never the numeric `id`.
 */
export function mapAgents(rows: Array<Record<string, unknown>>): AgentSummary[] {
  return rows.map((row) => ({
    id: String(row.agent_id ?? row.id),
    name: String(row.name ?? row.agent_id ?? row.id),
    state: row.state != null ? String(row.state) : undefined,
  }));
}

function historyMessages(
  rows: Array<{ role: string; content: unknown }>,
): ChatMessage[] {
  return rows.flatMap((row, index) => {
    if (row.role !== "user" && row.role !== "assistant" && row.role !== "system") {
      return [];
    }
    const content = extractTextContent(row.content);
    if (!content) return [];
    return [{ id: `history-${index}`, role: row.role, content }];
  });
}

export function buildWsUrl(baseUrl: string, agentId: string, token: string): string {
  const root = normalizeBaseUrl(baseUrl);
  const url = new URL(root);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const prefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${prefix}/api/agents/${encodeURIComponent(agentId)}/chat/ws`;
  url.search = "";
  url.hash = "";
  url.searchParams.set("token", token);
  return url.toString();
}

export const freeOsProvider: BackendProvider = {
  id: "freeos",
  labelZh: "FreeOS / XYAI",
  labelEn: "FreeOS",
  repoUrl: "https://github.com/XYAIStudio/FreeOS",
  ready: true,
  supportsThreads: true,
  defaultBaseUrl: FREEOS_DEFAULT_URL,
  secretKeys: [PASSWORD_KEY, TOKEN_KEY],

  async testConnection(ctx): Promise<ConnectionTestResult> {
    return runConnectionTest(async () => {
      let version = "";
      try {
        const health = await apiJson<Record<string, unknown>>(
          ctx.baseUrl,
          FREEOS_PATHS.health,
        );
        const status = String(health.status ?? "");
        if (status && status !== "ok") {
          return { ok: false, message: `FreeOS 健康检查异常：${status}` };
        }
        version = health.version != null ? String(health.version) : "";
      } catch (error) {
        if (error instanceof ProviderHttpError && error.status === 404) {
          /* older builds may omit /api/health; continue with setup/login */
        } else {
          throw error;
        }
      }

      const status = await apiJson<Record<string, unknown>>(
        ctx.baseUrl,
        FREEOS_PATHS.setupStatus,
      ).catch((error) => {
        if (error instanceof ProviderHttpError && error.status === 404) return null;
        throw error;
      });
      if (isSetupRequired(status)) {
        return {
          ok: false,
          message:
            "FreeOS 尚未完成初始化（setup_required）。请先在浏览器打开 http://127.0.0.1:8088 走完向导，再回来测试连接",
        };
      }

      let token: string;
      let profile: Record<string, unknown> | undefined;
      try {
        const resolved = await resolveAccessToken(ctx);
        token = resolved.token;
        profile = resolved.profile;
      } catch (error) {
        throw new Error(describeProviderError(error));
      }
      const me =
        profile ??
        (await apiJson<Record<string, unknown>>(ctx.baseUrl, FREEOS_PATHS.me, {
          token,
        }));
      const name = displayNameOf(me, ctx.username ?? "");
      const role = me.role != null ? String(me.role) : "";
      let agentCount: number | null = null;
      try {
        const rows = await apiJson<Array<Record<string, unknown>>>(
          ctx.baseUrl,
          FREEOS_PATHS.agents,
          { token },
        );
        agentCount = Array.isArray(rows) ? rows.length : null;
      } catch {
        /* agents optional during connection test */
      }

      const bits = [
        name ? `已连接：${name}` : "连接成功",
        role ? `角色 ${role}` : "",
        agentCount != null ? `${agentCount} 个智能体` : "",
        version && /^\d/.test(version) ? `v${version}` : "",
      ].filter(Boolean);
      return {
        ok: true,
        message: `${bits.join(" · ")}。可打开对话窗开始聊天`,
        detail: version || undefined,
      };
    });
  },

  async listAgents(ctx) {
    return withToken(ctx, async (token) => {
      const rows = await apiJson<Array<Record<string, unknown>>>(
        ctx.baseUrl,
        FREEOS_PATHS.agents,
        {
          token,
        },
      );
      return mapAgents(rows ?? []);
    });
  },

  async ensureThread(ctx, agentId) {
    return createThread(ctx, agentId);
  },

  async loadHistory(ctx, agentId, threadId) {
    return withToken(ctx, async (token) => {
      const history = await apiJsonWithFallback<{
        messages: Array<{ role: string; content: unknown }>;
      }>(
        ctx,
        token,
        FREEOS_PATHS.threadHistory(agentId, threadId),
        FREEOS_PATHS.sessionHistory(agentId, threadId),
      );
      return historyMessages(history.messages ?? []);
    });
  },

  async sendChat(ctx, input: SendChatInput): Promise<SendChatHandle> {
    let socket: WebSocket | null = null;
    let cancelled = false;
    let finished = false;
    let pingTimer = 0;
    let threadId = input.threadId ?? "";
    let sessionKey = input.sessionKey ?? "";
    try {
      const resolved = await resolveThreadSession(ctx, input);
      threadId = resolved.threadId;
      sessionKey = resolved.sessionKey;
    } catch (error) {
      input.onError?.(
        error instanceof Error ? error.message : "无法创建 FreeOS 会话",
      );
      return { cancel: () => undefined };
    }

    const token = await withToken(ctx, async (t) => t);
    const wsUrl = buildWsUrl(ctx.baseUrl, input.agentId, token);
    input.onLifecycle?.("thinking");
    let assembled = "";
    let openTimer = 0;

    const finishDone = () => {
      if (finished || cancelled) return;
      finished = true;
      window.clearTimeout(openTimer);
      window.clearInterval(pingTimer);
      input.onDone?.(assembled);
      socket?.close();
    };

    const finishError = (message: string) => {
      if (finished || cancelled) return;
      finished = true;
      window.clearTimeout(openTimer);
      window.clearInterval(pingTimer);
      input.onError?.(formatFreeOsStreamError(message));
      socket?.close();
    };

    socket = new WebSocket(wsUrl);
    openTimer = window.setTimeout(() => {
      if (cancelled || finished) return;
      if (socket && socket.readyState !== WebSocket.OPEN) {
        finishError("WebSocket 连接超时，请确认 FreeOS 已在 :8088 启动");
      }
    }, 8_000);
    socket.onopen = () => {
      window.clearTimeout(openTimer);
      if (cancelled) {
        socket?.close();
        return;
      }
      input.onLifecycle?.("streaming");
      socket?.send(JSON.stringify(buildSubscribeFrame(threadId)));
      socket?.send(
        JSON.stringify(
          buildUserTurnFrame({
            text: input.text,
            threadId,
            sessionKey,
          }),
        ),
      );
      pingTimer = window.setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(buildPingFrame()));
        }
      }, 20_000);
    };
    socket.onmessage = (event) => {
      if (cancelled) return;
      try {
        const chunk = JSON.parse(String(event.data)) as FreeOsWsChunk;
        const delta = streamDeltaOf(chunk);
        if (delta) {
          assembled += delta;
          input.onAssistantDelta?.(assembled);
          return;
        }
        if (chunk.type === "tool_call_chunk") {
          input.onLifecycle?.("tool");
          return;
        }
        if (chunk.type === "done" || chunk.done === true) {
          finishDone();
          return;
        }
        if (chunk.type === "error") {
          finishError(streamErrorOf(chunk));
          return;
        }
        if (chunk.type === "turn_status" && chunk.active === false) {
          finishDone();
        }
      } catch {
        assembled += String(event.data);
        input.onAssistantDelta?.(assembled);
      }
    };
    socket.onerror = () => {
      if (!cancelled)
        finishError(
          "WebSocket 连接失败，请确认 FreeOS 已启动（默认 :8088）或改用模拟后端",
        );
    };
    socket.onclose = () => {
      window.clearTimeout(openTimer);
      window.clearInterval(pingTimer);
      if (cancelled || finished) return;
      if (assembled) {
        finished = true;
        input.onDone?.(assembled);
        return;
      }
      input.onError?.("对话连接已断开，请点击重新连接");
    };

    return {
      cancel: () => {
        cancelled = true;
        finished = true;
        window.clearTimeout(openTimer);
        window.clearInterval(pingTimer);
        if (socket && socket.readyState === WebSocket.OPEN && threadId) {
          socket.send(JSON.stringify(buildCancelFrame(threadId)));
        }
        socket?.close();
      },
    };
  },
};
