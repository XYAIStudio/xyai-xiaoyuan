import {
  DEFAULT_APP_CONFIG,
  normalizeLoadedConfig,
  activeBaseUrl,
} from "./configLogic";
import { enqueueChatItem, queuedPreview, shiftChatItem } from "./messageQueue";
import { chatErrorText, nextChatMessageId } from "./chatHelpers";
import { ProviderHttpError } from "./providers/http";

describe("config defaults", () => {
  it("keeps first-party provider endpoints and rejects unknown poses", () => {
    expect(DEFAULT_APP_CONFIG.providerId).toBe("freeos");
    expect(DEFAULT_APP_CONFIG.freeos.baseUrl).toBe("http://127.0.0.1:8088");
    expect(DEFAULT_APP_CONFIG.openxyos.baseUrl).toBe("http://127.0.0.1:3000");
    expect(DEFAULT_APP_CONFIG.grokbot.baseUrl).toBe("http://127.0.0.1:1340");
    expect(DEFAULT_APP_CONFIG.lockPose).toBe(false);
    const loaded = normalizeLoadedConfig({
      providerId: "not-a-backend",
      mascotId: "nope",
      petSize: 12,
      openxyos: { baseUrl: "http://127.0.0.1:3001", email: "a@b.c" },
    } as never);
    expect(loaded.providerId).toBe("freeos");
    expect(loaded.mascotId).toBe("wave");
    expect(loaded.lockPose).toBe(false);
    expect(loaded.petSize).toBe(180);
    expect(loaded.openxyos.email).toBe("a@b.c");
    expect(activeBaseUrl({ ...loaded, providerId: "openxyos" })).toBe(
      "http://127.0.0.1:3001",
    );
  });
});

describe("message queue", () => {
  it("caps at five items and previews text", () => {
    let queue = [] as ReturnType<typeof enqueueChatItem>["queue"];
    for (let i = 0; i < 5; i += 1) {
      const result = enqueueChatItem(queue, {
        id: `q-${i}`,
        text: `msg-${i}`,
        createdAt: i,
      });
      expect(result.ok).toBe(true);
      queue = result.queue;
    }
    expect(enqueueChatItem(queue, { id: "overflow", text: "x", createdAt: 9 }).ok).toBe(
      false,
    );
    const shifted = shiftChatItem(queue);
    expect(shifted.item?.id).toBe("q-0");
    expect(shifted.queue).toHaveLength(4);
    expect(queuedPreview({ id: "a", text: "  hello  ", createdAt: 0 })).toBe("hello");
  });
});

describe("chat helpers", () => {
  it("formats provider HTTP errors", () => {
    expect(nextChatMessageId("u")).toMatch(/^u-/);
    expect(chatErrorText(new ProviderHttpError(401, ""))).toContain("登录已失效");
    expect(chatErrorText(new ProviderHttpError(500, '{"detail":"boom"}'))).toContain(
      "boom",
    );
  });
});
