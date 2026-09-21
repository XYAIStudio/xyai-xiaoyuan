import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractTextContent,
  normalizeBaseUrl,
  parseApiErrorMessage,
  parseApiErrorCode,
  apiJson,
} from "./http";
import { BACKEND_PROVIDERS, getProvider } from "./registry";
import {
  buildCancelFrame,
  buildPingFrame,
  buildSubscribeFrame,
  buildUserTurnFrame,
  buildWsUrl,
  formatFreeOsStreamError,
  freeOsProvider,
  mapAgents,
} from "./freeos";
import type { ProviderContext } from "./types";
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
      parseApiErrorMessage(
        '{"error":{"code":"AUTH_FAILED","message":"invalid credentials"}}',
      ),
    ).toBe("invalid credentials");
    expect(
      parseApiErrorCode(
        '{"error":{"code":"AUTH_FAILED","message":"invalid credentials"}}',
      ),
    ).toBe("AUTH_FAILED");
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
    expect(buildWsUrl("http://127.0.0.1:8088", "main", "tok")).toBe(
      "ws://127.0.0.1:8088/api/agents/main/chat/ws?token=tok",
    );
  });

  it("maps FreeOS agents by string agent_id, not numeric id", () => {
    expect(
      mapAgents([
        { id: 1, agent_id: "main", name: "主助手", state: "idle" },
        { id: 2, name: "legacy" },
      ]),
    ).toEqual([
      { id: "main", name: "主助手", state: "idle" },
      { id: "2", name: "legacy", state: undefined },
    ]);
  });

  it("builds subscribe then user_turn frames with session_key", () => {
    expect(buildSubscribeFrame("main:dashboard:1:dm")).toEqual({
      type: "subscribe",
      thread_id: "main:dashboard:1:dm",
    });
    expect(
      buildUserTurnFrame({
        text: "你好",
        threadId: "tid-1",
        sessionKey: "main:dashboard:1:dm",
      }),
    ).toEqual({
      type: "user_turn",
      text: "你好",
      session_key: "main:dashboard:1:dm",
      thread_id: "tid-1",
      messages: [{ role: "user", content: "你好" }],
    });
    expect(buildCancelFrame("tid-1")).toEqual({ type: "cancel", thread_id: "tid-1" });
    expect(buildPingFrame()).toEqual({ type: "ping" });
    expect(formatFreeOsStreamError("模型调用多次重试后仍失败，请检查供应商")).toMatch(
      /模型\/供应商配置/,
    );
  });
});

describe("FreeOS sendChat websocket frames", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends subscribe then user_turn with session_key on open", async () => {
    class FakeWebSocket {
      static OPEN = 1;
      static CONNECTING = 0;
      static instances: FakeWebSocket[] = [];
      url: string;
      readyState = 0;
      sent: unknown[] = [];
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      onclose: (() => void) | null = null;
      constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
        queueMicrotask(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.onopen?.();
        });
      }
      send(data: string) {
        this.sent.push(JSON.parse(data));
      }
      close() {
        this.readyState = 3;
        this.onclose?.();
      }
    }
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const secrets = new Map<string, string>([["freeos_token", "tok"]]);
    const ctx: ProviderContext = {
      baseUrl: "http://127.0.0.1:8088",
      username: "xiaoyuan",
      getSecret: async (key) => secrets.get(key) ?? null,
      setSecret: async (key, value) => {
        secrets.set(key, value);
      },
      deleteSecret: async (key) => {
        secrets.delete(key);
      },
    };
    await freeOsProvider.sendChat(ctx, {
      agentId: "main",
      text: "hello",
      threadId: "tid-1",
      sessionKey: "main:dashboard:1:dm",
    });
    await vi.waitFor(() => {
      expect(FakeWebSocket.instances[0]?.sent.length).toBeGreaterThanOrEqual(2);
    });
    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe("ws://127.0.0.1:8088/api/agents/main/chat/ws?token=tok");
    expect(socket.sent[0]).toEqual({ type: "subscribe", thread_id: "tid-1" });
    expect(socket.sent[1]).toEqual({
      type: "user_turn",
      text: "hello",
      session_key: "main:dashboard:1:dm",
      thread_id: "tid-1",
      messages: [{ role: "user", content: "hello" }],
    });
  });
});

describe("openXYOS and grokbot helpers", () => {
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
