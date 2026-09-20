import type { ConnectionTestResult } from "./types";

export function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round(nowMs() - startedAt));
}

export function appendLatency(message: string, ms: number): string {
  if (/（\d+ms）/.test(message) || /\(\d+ms\)/.test(message)) return message;
  return `${message}（${ms}ms）`;
}

export function describeNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/url not allowed/i.test(message)) return message;
  if (/econnrefused|connection refused|err_connection_refused/i.test(message)) {
    return "端口无人监听。请先启动对应后端，或运行 npm run doctor / npm run mock:backends";
  }
  if (/enotfound|getaddrinfo|err_name_not_resolved/i.test(message)) {
    return "无法解析主机名，请检查地址是否写错";
  }
  if (/econnreset|connection reset/i.test(message)) {
    return "连接被重置，后端可能刚启动或拒绝了请求";
  }
  if (/timeout|超时|aborted|abort/i.test(message)) {
    return "连接超时，请确认后端已启动且地址、端口可访问";
  }
  if (
    /load failed|failed to fetch|networkerror|network request failed|error sending request|fetch failed/i.test(
      message,
    )
  ) {
    return "无法连接服务。请检查地址是否可访问（本机后端需先启动，可先 npm run doctor）";
  }
  return error instanceof Error ? error.message : message;
}

export async function runConnectionTest(
  probe: () => Promise<ConnectionTestResult>,
): Promise<ConnectionTestResult> {
  const started = nowMs();
  try {
    const result = await probe();
    const ms = elapsedMs(started);
    return {
      ...result,
      latencyMs: result.latencyMs ?? ms,
      message: appendLatency(result.message, result.latencyMs ?? ms),
    };
  } catch (error) {
    const ms = elapsedMs(started);
    return {
      ok: false,
      latencyMs: ms,
      message: appendLatency(describeNetworkError(error), ms),
    };
  }
}
