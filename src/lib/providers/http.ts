import { describeNetworkError } from "./connection";

export class ProviderHttpError extends Error {
  status: number;
  body: string;
  code?: string;
  constructor(status: number, body: string, message?: string) {
    super(message || parseApiErrorMessage(body) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
    this.code = parseApiErrorCode(body) ?? undefined;
  }
}

function asErrorEnvelope(data: unknown): {
  detail?: unknown;
  message?: unknown;
  error?: { message?: unknown; code?: unknown } | string;
} | null {
  return data && typeof data === "object"
    ? (data as {
        detail?: unknown;
        message?: unknown;
        error?: { message?: unknown; code?: unknown } | string;
      })
    : null;
}

export function parseApiErrorCode(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    const data = asErrorEnvelope(JSON.parse(trimmed) as unknown);
    if (data?.error && typeof data.error === "object" && typeof data.error.code === "string") {
      return data.error.code.trim() || null;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

export function parseApiErrorMessage(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    const data = asErrorEnvelope(JSON.parse(trimmed) as unknown);
    if (data) {
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
  return new Error(describeNetworkError(error));
}

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

function timeoutError(): Error {
  return new Error("连接超时，请确认后端已启动且地址可访问");
}

export async function clientFetch(
  input: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else
      init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  const { timeoutMs: _timeoutMs, signal: _signal, ...rest } = init ?? {};
  try {
    const requestInit: RequestInit = { ...rest, signal: controller.signal };
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
      return await tauriFetch(input, requestInit);
    }
    return await globalThis.fetch(input, requestInit);
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw timeoutError();
    }
    throw networkError(error);
  } finally {
    clearTimeout(timer);
  }
}

export async function apiJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit & { token?: string; timeoutMs?: number } = {},
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
