import { afterEach, describe, expect, it, vi } from "vitest";

import { appendLatency, describeNetworkError, runConnectionTest } from "./connection";
import { LIVE_DEFAULTS, MOCK_DEFAULTS, parseHostPort } from "./endpoints";
import { freeOsProvider } from "./freeos";
import { grokBotProvider } from "./grokbot";
import { openXyosProvider } from "./openxyos";
import type { ProviderContext } from "./types";

function ctx(baseUrl: string): ProviderContext {
  const secrets = new Map<string, string>([
    ["freeos_password", "xiaoyuan"],
    ["openxyos_password", "xiaoyuan"],
    ["grokbot_token", "mock-token"],
  ]);
  return {
    baseUrl,
    username: baseUrl.includes("3000") ? "xiaoyuan@xyai.local" : "xiaoyuan",
    getSecret: async (key) => secrets.get(key) ?? null,
    setSecret: async (key, value) => {
      secrets.set(key, value);
    },
    deleteSecret: async (key) => {
      secrets.delete(key);
    },
  };
}

describe("live endpoint contract", () => {
  it("keeps default ports aligned with docs and mock offsets", () => {
    expect(LIVE_DEFAULTS.freeos.port).toBe(8088);
    expect(LIVE_DEFAULTS.openxyos.port).toBe(3000);
    expect(LIVE_DEFAULTS.grokbot.port).toBe(1340);
    expect(MOCK_DEFAULTS.freeos.port).toBe(18088);
    expect(MOCK_DEFAULTS.openxyos.port).toBe(13000);
    expect(MOCK_DEFAULTS.grokbot.port).toBe(11340);
    expect(parseHostPort("http://127.0.0.1:8088/")).toEqual({
      host: "127.0.0.1",
      port: 8088,
    });
    expect(freeOsProvider.defaultBaseUrl).toBe(LIVE_DEFAULTS.freeos.url);
    expect(openXyosProvider.defaultBaseUrl).toBe(LIVE_DEFAULTS.openxyos.url);
    expect(grokBotProvider.defaultBaseUrl).toBe(LIVE_DEFAULTS.grokbot.url);
  });
});

describe("connection test contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports latency and Chinese errors", async () => {
    expect(
      describeNetworkError(new Error("connect ECONNREFUSED 127.0.0.1:8088")),
    ).toMatch(/端口无人监听/);
    expect(appendLatency("连接成功", 12)).toBe("连接成功（12ms）");
    const timed = await runConnectionTest(async () => ({
      ok: true,
      message: "已连接：小元",
    }));
    expect(timed.ok).toBe(true);
    expect(timed.latencyMs).toBeGreaterThanOrEqual(0);
    expect(timed.message).toMatch(/已连接：小元（\d+ms）/);
  });

  it("FreeOS testConnection hits setup + login + me", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/api/setup/status")) {
        return new Response(JSON.stringify({ setup_required: false }), { status: 200 });
      }
      if (String(url).endsWith("/api/auth/login")) {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
      }
      if (String(url).endsWith("/api/auth/me")) {
        return new Response(JSON.stringify({ username: "xiaoyuan" }), { status: 200 });
      }
      return new Response("missing", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await freeOsProvider.testConnection(ctx("http://127.0.0.1:8088"));
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toMatch(/已连接/);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("openXYOS testConnection hits /api/health", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/health")) {
        return new Response(JSON.stringify({ product: "openXYOS", status: "ready" }), {
          status: 200,
        });
      }
      return new Response("missing", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await openXyosProvider.testConnection({
      ...ctx("http://127.0.0.1:3000"),
      username: "",
    });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/健康检查通过/);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
