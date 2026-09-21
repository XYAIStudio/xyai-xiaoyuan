// @vitest-environment node
/** Real HTTP mock — Node fetch, not jsdom (CI jsdom times out on 127.0.0.1). */

import { afterEach, describe, expect, it } from "vitest";

import { describeNetworkError } from "./connection";
import { describeOctopCode, describeProviderError } from "./errors";
import { freeOsProvider } from "./freeos";
import { FREEOS_DEFAULT_PORT, FREEOS_PATHS, isSetupRequired } from "./freeosPaths";
import { ProviderHttpError } from "./http";
import type { ProviderContext } from "./types";

type MockHandle = {
  server: { close: (cb?: (error?: Error) => void) => void };
  port: number;
  url: string;
};

async function startMock(
  options: { setupRequired?: boolean } = {},
): Promise<MockHandle> {
  // Mock lives next to mock-backends; keep it out of the TS program.
  // @ts-expect-error -- scripts/lib/freeos-mock.mjs is untyped Node ESM
  const { listenFreeOsMock } = await import("../../../scripts/lib/freeos-mock.mjs");
  return listenFreeOsMock(0, "127.0.0.1", options) as Promise<MockHandle>;
}

function ctx(baseUrl: string, password = "xiaoyuan"): ProviderContext {
  const secrets = new Map<string, string>([["freeos_password", password]]);
  return {
    baseUrl,
    username: "xiaoyuan",
    getSecret: async (key) => secrets.get(key) ?? null,
    setSecret: async (key, value) => {
      secrets.set(key, value);
    },
    deleteSecret: async (key) => {
      secrets.delete(key);
    },
  };
}

describe("FreeOS :8088 contract (mock)", () => {
  let handle: MockHandle | null = null;

  afterEach(async () => {
    if (!handle) return;
    const current = handle;
    handle = null;
    await new Promise<void>((resolve, reject) => {
      current.server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  });

  it("keeps live paths aligned with FreeOS routers", () => {
    expect(FREEOS_DEFAULT_PORT).toBe(8088);
    expect(FREEOS_PATHS.health).toBe("/health");
    expect(FREEOS_PATHS.setupStatus).toBe("/setup/status");
    expect(FREEOS_PATHS.login).toBe("/auth/login");
    expect(FREEOS_PATHS.createThread("main")).toBe("/agents/main/threads");
    expect(FREEOS_PATHS.createSession("main")).toBe("/agents/main/chat/sessions");
    expect(isSetupRequired({ setup_required: true })).toBe(true);
    expect(isSetupRequired({ required: true })).toBe(true);
    expect(isSetupRequired({ setup_required: false })).toBe(false);
    expect(describeOctopCode("AUTH_FAILED")).toMatch(/用户名或密码/);
    expect(
      describeProviderError(
        new ProviderHttpError(
          401,
          JSON.stringify({
            error: { code: "AUTH_FAILED", message: "invalid credentials" },
          }),
        ),
      ),
    ).toMatch(/用户名或密码错误/);
    expect(describeNetworkError(new Error("fetch failed"))).toMatch(/8088|doctor/);
  });

  it("testConnection + agents + threads against the :8088 mock", async () => {
    handle = await startMock();
    const providerCtx = ctx(handle.url);
    const result = await freeOsProvider.testConnection(providerCtx);
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/已连接：模拟小元/);
    expect(result.message).toMatch(/智能体/);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const agents = await freeOsProvider.listAgents(providerCtx);
    expect(agents[0]?.id).toBe("xiaoyuan");

    const thread = await freeOsProvider.ensureThread?.(providerCtx, "xiaoyuan");
    expect(thread?.threadId).toBe("thread-mock");

    const history = await freeOsProvider.loadHistory?.(
      providerCtx,
      "xiaoyuan",
      "thread-mock",
    );
    expect(history).toEqual([]);
  });

  it("testConnection accepts a stored token without password", async () => {
    handle = await startMock();
    const secrets = new Map<string, string>([["freeos_token", "mock-freeos-token"]]);
    const result = await freeOsProvider.testConnection({
      baseUrl: handle.url,
      username: "",
      getSecret: async (key) => secrets.get(key) ?? null,
      setSecret: async (key, value) => {
        secrets.set(key, value);
      },
      deleteSecret: async (key) => {
        secrets.delete(key);
      },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/已连接：模拟小元/);
  });

  it("rejects wrong password with Chinese AUTH_FAILED", async () => {
    handle = await startMock();
    const result = await freeOsProvider.testConnection(ctx(handle.url, "wrong"));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/用户名或密码错误/);
  });

  it("surfaces setup_required before login", async () => {
    handle = await startMock({ setupRequired: true });
    const result = await freeOsProvider.testConnection(ctx(handle.url));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/尚未完成初始化/);
  });
});
