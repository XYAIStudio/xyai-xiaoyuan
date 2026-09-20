export class ProviderHttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, message?: string) {
    super(message || parseApiErrorMessage(body) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export function parseApiErrorMessage(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed) as {
      detail?: unknown;
      message?: unknown;
      error?: { message?: unknown } | string;
    };
    if (data && typeof data === "object") {
      if (
        data.error &&
        typeof data.error === "object" &&
        typeof data.error.message === "string" &&
        data.error.message.trim()
      ) {
        return data.error.message.trim();
      }
      if (typeof data.detail === "string" && data.detail.trim()) {
        return data.detail.trim();
      }
      if (typeof data.message === "string" && data.message.trim()) {
        return data.message.trim();
      }
      if (typeof data.error === "string" && data.error.trim()) {
        return data.error.trim();
      }
    }
  } catch {
    if (trimmed.length < 160 && !trimmed.startsWith("{")) return trimmed;
  }
  return null;
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("服务地址不能为空");
  return trimmed;
}

function networkError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /load failed|failed to fetch|networkerror|network request failed|error sending request|url not allowed/i.test(
      message,
    )
  ) {
    return new Error(
      message.includes("url not allowed") ? message : "无法连接服务，请检查地址是否可访问",
    );
  }
  return error instanceof Error ? error : new Error(message);
}

export async function clientFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
      return await tauriFetch(input, init);
    }
    return await globalThis.fetch(input, init);
  } catch (error) {
    throw networkError(error);
  }
}

export async function apiJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const root = normalizeBaseUrl(baseUrl);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  const { token: _token, ...rest } = init;
  const prefix = path.startsWith("/api") || path.startsWith("http") ? "" : "/api";
  const url = path.startsWith("http") ? path : `${root}${prefix}${path}`;
  const res = await clientFetch(url, { ...rest, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new ProviderHttpError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text ?? "");
        }
        if (part && typeof part === "object" && "content" in part) {
          return extractTextContent((part as { content: unknown }).content);
        }
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text: unknown }).text ?? "");
  }
  return "";
}
