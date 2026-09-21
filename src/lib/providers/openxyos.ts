import type { AgentSummary, ChatMessage } from "../types";
import type {
  BackendProvider,
  ConnectionTestResult,
  ProviderContext,
  SendChatHandle,
  SendChatInput,
} from "./types";
import { runConnectionTest } from "./connection";
import { apiJson, clientFetch, extractTextContent, normalizeBaseUrl } from "./http";

const TOKEN_KEY = "openxyos_token";
const PASSWORD_KEY = "openxyos_password";

interface AuthEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

async function login(ctx: ProviderContext): Promise<string> {
  const password = await ctx.getSecret(PASSWORD_KEY);
  if (!ctx.username?.trim() || !password) {
    throw new Error("请先在设置中填写 openXYOS 邮箱和密码");
  }
  const raw = await apiJson<AuthEnvelope<{ tokens?: { accessToken?: string } }>>(
    ctx.baseUrl,
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email: ctx.username.trim(), password }),
    },
  );
  const token = raw.data?.tokens?.accessToken;
  if (!token) throw new Error("登录响应缺少 accessToken");
  await ctx.setSecret(TOKEN_KEY, token);
  return token;
}

async function withToken<T>(
  ctx: ProviderContext,
  operation: (token: string) => Promise<T>,
): Promise<T> {
  let token = await ctx.getSecret(TOKEN_KEY);
  if (!token) token = await login(ctx);
  try {
    return await operation(token);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 401) throw error;
    await ctx.deleteSecret(TOKEN_KEY);
    token = await login(ctx);
    return await operation(token);
  }
}

function unwrapData<T>(raw: AuthEnvelope<T> | T[]): T | T[] {
  if (raw && typeof raw === "object" && "data" in raw) {
    return (raw as AuthEnvelope<T>).data as T;
  }
  return raw as T;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter(
      (row): row is Record<string, unknown> => !!row && typeof row === "object",
    );
  }
  return [];
}

/** Last AI employee message from POST /api/chats/:id/messages (`data` is the full message list). */
export function lastEmployeeReply(data: unknown): string {
  let rows = asRecordArray(data);
  if (rows.length === 0 && data && typeof data === "object" && "messages" in data) {
    rows = asRecordArray((data as { messages?: unknown }).messages);
  }
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const sender = String(row.sender_type ?? row.role ?? "");
    const messageType = String(row.message_type ?? "");
    if (messageType === "ai_progress") continue;
    if (sender === "employee" || sender === "assistant") {
      const text = extractTextContent(row.content);
      if (text.trim()) return text;
    }
  }
  return "";
}

export const openXyosProvider: BackendProvider = {
  id: "openxyos",
  labelZh: "openXYOS 组织 OS",
  labelEn: "openXYOS",
  repoUrl: "https://github.com/XYAIStudio/openXYOS",
  ready: true,
  supportsThreads: true,
  defaultBaseUrl: "http://127.0.0.1:3000",
  secretKeys: [PASSWORD_KEY, TOKEN_KEY],

  async testConnection(ctx): Promise<ConnectionTestResult> {
    return runConnectionTest(async () => {
      const health = await apiJson<Record<string, unknown>>(ctx.baseUrl, "/health");
      const product = String(health.product ?? "openXYOS");
      if (!ctx.username?.trim()) {
        return {
          ok: true,
          message: `${product} 健康检查通过（尚未登录）`,
          detail: String(health.status ?? "ready"),
        };
      }
      const token = await login(ctx);
      const me = await apiJson<AuthEnvelope<{ nickname?: string; email?: string }>>(
        ctx.baseUrl,
        "/auth/me",
        { token },
      );
      const name = me.data?.nickname || me.data?.email || ctx.username;
      return { ok: true, message: `已连接 ${product}：${name}` };
    });
  },

  async listAgents(ctx) {
    return withToken(ctx, async (token) => {
      const agents: AgentSummary[] = [
        { id: "assistant:xiaoxiong", name: "小雄（智能助手）" },
      ];
      try {
        const chats = await apiJson<AuthEnvelope<Array<Record<string, unknown>>>>(
          ctx.baseUrl,
          "/chats",
          { token },
        );
        const rows = asRecordArray(unwrapData(chats));
        for (const row of rows) {
          agents.push({
            id: `chat:${String(row.id)}`,
            name: String(row.title ?? `会话 ${row.id}`),
          });
        }
      } catch {
        /* chats optional */
      }
      return agents;
    });
  },

  async ensureThread(_ctx, agentId) {
    if (agentId.startsWith("chat:")) {
      return { threadId: agentId.slice("chat:".length) };
    }
    return { threadId: "xiaoyuan" };
  },

  async loadHistory(ctx, agentId) {
    if (!agentId.startsWith("chat:")) return [];
    const chatId = agentId.slice("chat:".length);
    return withToken(ctx, async (token) => {
      const raw = await apiJson<
        AuthEnvelope<{ messages?: Array<Record<string, unknown>> }>
      >(ctx.baseUrl, `/chats/${encodeURIComponent(chatId)}/messages?limit=50`, {
        token,
      });
      const messages = asRecordArray(
        (raw.data as { messages?: unknown } | undefined)?.messages,
      );
      return messages.flatMap((row, index) => {
        const content = extractTextContent(row.content);
        if (!content) return [];
        const role =
          String(row.sender_type ?? row.role ?? "") === "user" || row.user_id != null
            ? "user"
            : "assistant";
        return [
          {
            id: String(row.id ?? `m-${index}`),
            role: role as ChatMessage["role"],
            content,
          },
        ];
      });
    });
  },

  async sendChat(ctx, input: SendChatInput): Promise<SendChatHandle> {
    let cancelled = false;
    input.onLifecycle?.("thinking");
    const run = async () => {
      try {
        if (input.agentId.startsWith("chat:")) {
          const chatId = input.agentId.slice("chat:".length);
          const raw = await withToken(ctx, (token) =>
            apiJson<AuthEnvelope<unknown>>(
              ctx.baseUrl,
              `/chats/${encodeURIComponent(chatId)}/messages`,
              {
                method: "POST",
                token,
                body: JSON.stringify({ content: input.text }),
              },
            ),
          );
          const payload = unwrapData(raw);
          if (cancelled) return;
          const text = lastEmployeeReply(payload) || lastEmployeeReply(raw.data);
          input.onAssistantDelta?.(text);
          input.onDone?.(text || "已发送");
          return;
        }

        const history = (input.history ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }));
        const raw = await apiJson<{ reply?: string }>(ctx.baseUrl, "/assistant/chat", {
          method: "POST",
          body: JSON.stringify({
            message: input.text,
            history,
            session_id: input.threadId || "xiaoyuan",
          }),
        });
        if (cancelled) return;
        const reply = raw.reply || "";
        input.onAssistantDelta?.(reply);
        input.onDone?.(reply);
      } catch (error) {
        if (!cancelled) {
          input.onError?.(error instanceof Error ? error.message : "发送失败");
        }
      }
    };
    void run();
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  },
};

export async function probeOpenXyos(baseUrl: string): Promise<boolean> {
  try {
    const res = await clientFetch(`${normalizeBaseUrl(baseUrl)}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
