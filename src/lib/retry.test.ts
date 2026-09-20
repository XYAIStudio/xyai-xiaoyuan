import { afterEach, describe, expect, it, vi } from "vitest";

import { mockAssistantReply, mockShouldCallTool, mockTokenChunks } from "./mockReplies";
import { withRetry } from "./retry";
import { APP_VERSION, checkAppUpdate } from "./updates";

describe("withRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries and then succeeds", async () => {
    vi.useFakeTimers();
    let hits = 0;
    const pending = withRetry(
      async () => {
        hits += 1;
        if (hits < 3) throw new Error("flaky");
        return "ok";
      },
      { attempts: 3, delayMs: 10 },
    );
    await vi.runAllTimersAsync();
    await expect(pending).resolves.toBe("ok");
    expect(hits).toBe(3);
  });
});

describe("mock replies", () => {
  it("shapes thanks, create, and tool turns for pose demos", () => {
    expect(mockAssistantReply("谢谢小元")).toContain("不客气");
    expect(mockAssistantReply("画一张星空")).toContain("构思画面");
    expect(mockShouldCallTool("请搜索一下天气")).toBe(true);
    expect(mockTokenChunks("hi").join("")).toBe(mockAssistantReply("hi"));
  });
});

describe("updater helpers", () => {
  it("exposes the package version and skips live checks in jsdom", async () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    await expect(checkAppUpdate()).resolves.toEqual({ status: "desktop-only" });
  });
});
