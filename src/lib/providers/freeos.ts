import type { AgentSummary, ChatMessage } from "../types";
import type {
  BackendProvider,
  ConnectionTestResult,
  ProviderContext,
  SendChatHandle,
  SendChatInput,
} from "./types";
import {
  apiJson,
  extractTextContent,
  normalizeBaseUrl,
  ProviderHttpError,
} from "./http";

const TOKEN_KEY = "freeos_token";
const PASSWORD_KEY = "freeos_password";

async function login(ctx: ProviderContext): Promise<{ access_token: string }> {
  const password = await ctx.getSecret(PASSWORD_KEY);
  if (!ctx.username?.trim() || !password) {
    throw new Error("请先在设置中填写 FreeOS 用户名和密码");
  }
  const result = await apiJson<{ access_token: string }>(ctx.baseUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: ctx.username.trim(), password }),
  });
  if (!result.access_token) {
    throw new Error("登录响应缺少 access_token");
  }
  await ctx.setSecret(TOKEN_KEY, result.access_token);
  return result;
}

async function withToken<T>(
  ctx: ProviderContext,
  operation: (token: string) => Promise<T>,
): Promise<T> {
  let token = await ctx.getSecret(TOKEN_KEY);
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

function mapAgents(rows: Array<Record<string, unknown>>): AgentSummary[] {
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
  defaultBaseUrl: "http://127.0.0.1:8088",
  secretKeys: [PASSWORD_KEY, TOKEN_KEY],

  async testConnection(ctx): Promise<ConnectionTestResult> {
    try {
      const status = await apiJson<{ setup_required?: boolean }>(
        ctx.baseUrl,
        "/setup/status",
      ).catch(() => null);
      if (status?.setup_required) {
        return { ok: false, message: "FreeOS 尚未完成初始化（setup_required）" };
      }
      const token = (await login(ctx)).access_token;
      const me = await apiJson<Record<string, unknown>>(ctx.baseUrl, "/auth/me", {
        token,
      });
      const name = String(me.display_name ?? me.username ?? ctx.username ?? "");
      return { ok: true, message: name ? `已连接：${name}` : "连接成功" };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "连接失败",
      };
    }
  },

  async listAgents(ctx) {
    return withToken(ctx, async (token) => {
      const rows = await apiJson<Array<Record<string, unknown>>>(
        ctx.baseUrl,
        "/agents",
        {
          token,
        },
      );
      return mapAgents(rows ?? []);
    });
  },

  async ensureThread(ctx, agentId) {
    return withToken(ctx, (token) =>
      apiJson<{ thread_id: string; session_key?: string }>(
        ctx.baseUrl,
        `/agents/${encodeURIComponent(agentId)}/threads`,
        { method: "POST", token },
      ).then((created) => ({
        threadId: created.thread_id,
        sessionKey: created.session_key,
      })),
    );
  },

  async loadHistory(ctx, agentId, threadId) {
    return withToken(ctx, async (token) => {
      const history = await apiJson<{
        messages: Array<{ role: string; content: unknown }>;
      }>(
        ctx.baseUrl,
        `/agents/${encodeURIComponent(agentId)}/threads/${encodeURIComponent(threadId)}/history?limit=50&offset=0`,
        { token },
      );
      return historyMessages(history.messages ?? []);
    });
  },

  async sendChat(ctx, input: SendChatInput): Promise<SendChatHandle> {
    let socket: WebSocket | null = null;
    let cancelled = false;
    const token = await withToken(ctx, async (t) => t);
    const wsUrl = buildWsUrl(ctx.baseUrl, input.agentId, token);
    input.onLifecycle?.("thinking");

    socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      if (cancelled) {
        socket?.close();
        return;
      }
      input.onLifecycle?.("streaming");
      socket?.send(
        JSON.stringify({
          type: "user_turn",
          text: input.text,
          thread_id: input.threadId,
          messages: [{ role: "user", content: input.text }],
        }),
      );
    };
    let assembled = "";
    socket.onmessage = (event) => {
      if (cancelled) return;
      try {
        const chunk = JSON.parse(String(event.data)) as {
          type?: string;
          content?: string;
          message?: string;
        };
        if (chunk.type === "token" && typeof chunk.content === "string") {
          assembled += chunk.content;
          input.onAssistantDelta?.(assembled);
        } else if (chunk.type === "tool_call_chunk") {
          input.onLifecycle?.("tool");
        } else if (chunk.type === "done") {
          input.onDone?.(assembled);
          socket?.close();
        } else if (chunk.type === "error") {
          input.onError?.(chunk.message || "流式错误");
          socket?.close();
        }
      } catch {
        assembled += String(event.data);
        input.onAssistantDelta?.(assembled);
      }
    };
    socket.onerror = () => {
      if (!cancelled) input.onError?.("WebSocket 连接失败");
    };
    socket.onclose = () => {
      if (!cancelled && assembled) {
        /* done already or connection dropped */
      }
    };

    return {
      cancel: () => {
        cancelled = true;
        if (socket && socket.readyState === WebSocket.OPEN && input.threadId) {
          socket.send(JSON.stringify({ type: "cancel", thread_id: input.threadId }));
        }
        socket?.close();
      },
    };
  },
};
