import type { AgentSummary, ChatMessage } from "../types";

export const PROVIDER_IDS = ["freeos", "openxyos", "xyai-studio", "grokbot"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export interface ProviderContext {
  baseUrl: string;
  username?: string;
  getSecret: (key: string) => Promise<string | null>;
  setSecret: (key: string, value: string) => Promise<void>;
  deleteSecret: (key: string) => Promise<void>;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  detail?: string;
  /** Round-trip time of the connection test, when measured. */
  latencyMs?: number;
}

export interface SendChatInput {
  agentId: string;
  text: string;
  threadId?: string | null;
  /** FreeOS `session_key` from POST /threads (e.g. `main:dashboard:1:dm`). */
  sessionKey?: string | null;
  history?: ChatMessage[];
  onLifecycle?: (life: string) => void;
  onAssistantDelta?: (text: string) => void;
  onDone?: (text: string) => void;
  onError?: (message: string) => void;
}

export interface SendChatHandle {
  cancel: () => void;
}

export interface BackendProvider {
  id: ProviderId;
  labelZh: string;
  labelEn: string;
  repoUrl?: string;
  ready: boolean;
  notReadyReason?: string;
  supportsThreads: boolean;
  defaultBaseUrl: string;
  secretKeys: string[];
  testConnection: (ctx: ProviderContext) => Promise<ConnectionTestResult>;
  listAgents: (ctx: ProviderContext) => Promise<AgentSummary[]>;
  ensureThread?: (
    ctx: ProviderContext,
    agentId: string,
  ) => Promise<{ threadId: string; sessionKey?: string }>;
  loadHistory?: (
    ctx: ProviderContext,
    agentId: string,
    threadId: string,
  ) => Promise<ChatMessage[]>;
  sendChat: (ctx: ProviderContext, input: SendChatInput) => Promise<SendChatHandle>;
}
