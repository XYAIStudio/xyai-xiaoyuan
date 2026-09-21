/**
 * FreeOS HTTP contract used by 小元.
 *
 * Verified against XYAIStudio/FreeOS `src/octop/api/routers/*` (auth.py,
 * setup.py, agents.py, chat/history.py, chat/ws.py) and `docs/api.md`.
 *
 * Live routers use `/api/agents/{id}/threads` for create/history.
 * `docs/api.md` also lists `/api/agents/{id}/chat/sessions` — treat that as
 * a fallback only; do not invent other routes.
 */
export const FREEOS_DEFAULT_URL = "http://127.0.0.1:8088";
export const FREEOS_DEFAULT_PORT = 8088;

export const FREEOS_PATHS = {
  health: "/health",
  setupStatus: "/setup/status",
  login: "/auth/login",
  me: "/auth/me",
  agents: "/agents",
  /** `agentId` must be the string `agent_id` (e.g. `main`), not numeric `id`. */
  createThread: (agentId: string) => `/agents/${encodeURIComponent(agentId)}/threads`,
  threadHistory: (agentId: string, threadId: string) =>
    `/agents/${encodeURIComponent(agentId)}/threads/${encodeURIComponent(threadId)}/history?limit=50&offset=0`,
  /** Docs-table alias; only used when the live `/threads` route returns 404. */
  createSession: (agentId: string) =>
    `/agents/${encodeURIComponent(agentId)}/chat/sessions`,
  sessionHistory: (agentId: string, threadId: string) =>
    `/agents/${encodeURIComponent(agentId)}/chat/sessions/${encodeURIComponent(threadId)}/history?limit=50&offset=0`,
} as const;

export function isSetupRequired(
  status: Record<string, unknown> | null | undefined,
): boolean {
  if (!status) return false;
  if (status.setup_required === true || status.required === true) return true;
  if (status.completed === false && status.has_admin === false) return true;
  return false;
}

export function loginTokenOf(raw: Record<string, unknown>): string | null {
  const direct = raw.access_token;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = raw.data;
  if (nested && typeof nested === "object") {
    const token = (nested as { access_token?: unknown }).access_token;
    if (typeof token === "string" && token.trim()) return token.trim();
  }
  return null;
}

export function displayNameOf(
  profile: Record<string, unknown> | undefined,
  fallback = "",
): string {
  if (!profile) return fallback;
  const user =
    profile.user && typeof profile.user === "object"
      ? (profile.user as Record<string, unknown>)
      : profile;
  const name = user.display_name ?? user.username ?? user.email ?? fallback;
  return name != null ? String(name) : fallback;
}
