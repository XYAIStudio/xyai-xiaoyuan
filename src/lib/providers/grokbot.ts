import type { AgentSummary } from "../types";
import type {
  BackendProvider,
  ConnectionTestResult,
  ProviderContext,
  SendChatHandle,
  SendChatInput,
} from "./types";
import { runConnectionTest } from "./connection";
import { apiJson, clientFetch, extractTextContent, normalizeBaseUrl } from "./http";

const TOKEN_KEY = "grokbot_token";

interface GatewayFile {
  port?: number;
  scheme?: string;
  host?: string;
  token?: string;
}

async function tokenOf(ctx: ProviderContext): Promise<string> {
  const token = await ctx.getSecret(TOKEN_KEY);
  if (!token?.trim()) {
    throw new Error("请粘贴网关令牌，或从 gateway.json 导入（令牌保存在系统钥匙串）");
  }
  return token.trim();
}

async function command<T>(
  ctx: ProviderContext,
  name: string,
  body: unknown = {},
): Promise<T> {
  const token = await tokenOf(ctx);
  return apiJson<T>(ctx.baseUrl, `/${name}`, {
    method: "POST",
    token,
    body: JSON.stringify(body ?? {}),
  });
}

function lastAssistantText(rows: unknown): string {
  if (!Array.isArray(rows)) return "";
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i] as Record<string, unknown>;
    const role = String(row.role ?? row.sender ?? row.type ?? "");
    if (/assistant|agent|bot/i.test(role) || row.isAssistant === true) {
      const text = extractTextContent(
        row.content ?? row.text ?? row.body ?? row.message,
      );
      if (text) return text;
    }
  }
  const last = rows[rows.length - 1] as Record<string, unknown> | undefined;
  return last
    ? extractTextContent(last.content ?? last.text ?? last.body ?? last.message)
    : "";
}

export const grokBotProvider: BackendProvider = {
  id: "grokbot",
  labelZh: "本机 Grok Bot",
  labelEn: "Local Grok Bot gateway",
  ready: true,
  supportsThreads: false,
  defaultBaseUrl: "http://127.0.0.1:1340",
  secretKeys: [TOKEN_KEY],

  async testConnection(ctx): Promise<ConnectionTestResult> {
    return runConnectionTest(async () => {
      const healthRes = await clientFetch(`${normalizeBaseUrl(ctx.baseUrl)}/health`);
      if (!healthRes.ok) throw new Error(`health HTTP ${healthRes.status}`);
      const health = (await healthRes.json()) as Record<string, unknown>;
      const tokenOk = Boolean((await ctx.getSecret(TOKEN_KEY))?.trim());
      if (!tokenOk) {
        return {
          ok: false,
          message: `网关可达（${String(health.status ?? health.ok ?? "ok")}），但尚未配置令牌`,
        };
      }
      const agents = await command<AgentSummary[] | { agents?: AgentSummary[] }>(
        ctx,
        "listAgents",
        {},
      );
      const count = Array.isArray(agents)
        ? agents.length
        : Array.isArray(agents.agents)
          ? agents.agents.length
          : 0;
      return { ok: true, message: `网关正常，智能体 ${count} 个` };
    });
  },

  async listAgents(ctx) {
    const rows = await command<
      Array<Record<string, unknown>> | { agents?: Array<Record<string, unknown>> }
    >(ctx, "listAgents", {});
    const list = Array.isArray(rows) ? rows : (rows.agents ?? []);
    return list.map((row) => ({
      id: String(row.id ?? row.agentId ?? row.uuid),
      name: String(row.name ?? row.title ?? row.id),
      state: row.isBusy ? "busy" : undefined,
    }));
  },

  async sendChat(ctx, input: SendChatInput): Promise<SendChatHandle> {
    let cancelled = false;
    input.onLifecycle?.("thinking");
    const run = async () => {
      try {
        const accepted = await command<{ accepted?: boolean }>(ctx, "sendPrompt", {
          agentId: input.agentId,
          prompt: input.text,
        });
        if (cancelled) return;
        if (accepted && accepted.accepted === false) {
          input.onError?.("网关未接受该提示");
          return;
        }
        input.onLifecycle?.("streaming");
        const deadline = Date.now() + 120_000;
        let reply = "";
        while (!cancelled && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (cancelled) return;
          try {
            const healthRes = await clientFetch(
              `${normalizeBaseUrl(ctx.baseUrl)}/health`,
            );
            if (healthRes.ok) {
              const health = (await healthRes.json()) as { isBusy?: boolean };
              if (health.isBusy) continue;
            }
          } catch {
            /* health optional while polling */
          }
          try {
            const transcript = await command<unknown>(ctx, "getAgentTranscript", {
              id: input.agentId,
            });
            reply = lastAssistantText(transcript);
            if (reply) {
              input.onAssistantDelta?.(reply);
              break;
            }
          } catch {
            const page = await command<unknown>(ctx, "getTranscript", {}).catch(
              () => null,
            );
            reply = lastAssistantText(page);
            if (reply) {
              input.onAssistantDelta?.(reply);
              break;
            }
          }
        }
        if (cancelled) return;
        input.onDone?.(reply || "已提交到本机网关（未读到回复，接口可能已变更）");
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

export function gatewayFileToSettings(file: GatewayFile): {
  baseUrl?: string;
  token?: string;
} {
  const port = file.port || 1340;
  const scheme = file.scheme || "http";
  let host = file.host || "127.0.0.1";
  if (host === "0.0.0.0" || host === "::") host = "127.0.0.1";
  return {
    baseUrl: `${scheme}://${host}:${port}`,
    token: file.token,
  };
}
