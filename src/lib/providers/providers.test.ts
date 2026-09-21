import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractTextContent,
  normalizeBaseUrl,
  parseApiErrorMessage,
  apiJson,
} from "./http";
import { BACKEND_PROVIDERS, getProvider } from "./registry";
import { buildWsUrl } from "./freeos";
import { lastEmployeeReply } from "./openxyos";
import { gatewayFileToSettings } from "./grokbot";
import { xyaiStudioProvider } from "./xyaiStudio";

describe("BackendProvider registry", () => {
  it("registers FreeOS, openXYOS, XYAI Studio, and local Grok Bot", () => {
    expect(BACKEND_PROVIDERS.map((provider) => provider.id)).toEqual([
      "freeos",
      "openxyos",
      "xyai-studio",
      "grokbot",
    ]);
    expect(BACKEND_PROVIDERS.every((provider) => provider.labelZh.length > 0)).toBe(
      true,
    );
    expect(getProvider("freeos").ready).toBe(true);
    expect(getProvider("openxyos").ready).toBe(true);
    expect(getProvider("grokbot").ready).toBe(true);
    expect(xyaiStudioProvider.ready).toBe(false);
    expect(xyaiStudioProvider.notReadyReason).toMatch(/未就绪/);
    expect(() => getProvider("missing")).toThrow(/未知后端/);
  });
});

describe("http helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses errors and prefixes /api unless already present", async () => {
    expect(normalizeBaseUrl("http://127.0.0.1:8088/")).toBe("http://127.0.0.1:8088");
    expect(parseApiErrorMessage('{"detail":"nope"}')).toBe("nope");
    expect(
      parseApiErrorMessage('{"error":{"code":"AUTH_FAILED","message":"invalid credentials"}}'),
    ).toBe("invalid credentials");
    expect(extractTextContent([{ text: "a" }, { text: "b" }])).toBe("ab");

    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("http://127.0.0.1:8088/api/agents");
      return new Response(JSON.stringify([{ id: "a1", name: "助手" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const rows = await apiJson<Array<{ id: string }>>(
      "http://127.0.0.1:8088",
      "/agents",
    );
    expect(rows[0].id).toBe("a1");
  });

  it("does not double-prefix /api or rewrite health URLs", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("http://127.0.0.1:1340/health");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await apiJson("http://127.0.0.1:1340", "http://127.0.0.1:1340/health");
  });

  it("times out hung requests", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init?: RequestInit) => {
          return new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => {
              const error = new Error("Aborted");
              error.name = "AbortError";
              reject(error);
            });
          });
        }),
      );
      const pending = apiJson("http://127.0.0.1:9", "/agents", { timeoutMs: 40 });
      const expectation = expect(pending).rejects.toThrow(/超时/);
      await vi.advanceTimersByTimeAsync(50);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("provider-specific helpers", () => {
  it("builds FreeOS websocket URLs with token query", () => {
    expect(buildWsUrl("http://127.0.0.1:8088", "agent-1", "tok")).toBe(
      "ws://127.0.0.1:8088/api/agents/agent-1/chat/ws?token=tok",
    );
  });

  it("reads the last openXYOS employee reply and rewrites grokbot bind addresses", () => {
    expect(
      lastEmployeeReply([
        { sender_type: "user", content: "hi" },
        { sender_type: "system", message_type: "ai_progress", content: "…" },
        { sender_type: "employee", content: "你好，我是同事" },
      ]),
    ).toBe("你好，我是同事");
    expect(
      gatewayFileToSettings({
        host: "0.0.0.0",
        port: 1340,
        scheme: "http",
        token: "t",
      }),
    ).toEqual({ baseUrl: "http://127.0.0.1:1340", token: "t" });
  });
});
