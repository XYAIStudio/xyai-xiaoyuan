import { afterEach, describe, expect, it, vi } from "vitest";

import { poseForLifecycle, preloadPetPoses, resetPosePreloadCache } from "./mascots";
import {
  chatPoseTakesPriority,
  evolveLifecycle,
  isBusyLifecycle,
  nextIdlePose,
  pickFromPool,
  planCrossfade,
  poseFromActivity,
  poseHintFromUserText,
  posesForLifecycle,
  resolveCompanionPose,
  resolvePose,
  shouldPauseIdleCycle,
  STREAM_TO_CREATE_MS,
} from "./poseMachine";
import type { ActivitySnapshot } from "./activity";

describe("pose pools and lifecycle mapping", () => {
  it("maps app states onto the official pose packs", () => {
    expect(posesForLifecycle("idle")).toEqual(["wave", "hug"]);
    expect(posesForLifecycle("welcome")).toEqual(["hug", "wave"]);
    expect(posesForLifecycle("thinking")).toEqual(["think", "idea"]);
    expect(posesForLifecycle("streaming")).toEqual(["think", "idea"]);
    expect(posesForLifecycle("tool")).toEqual(["run", "explore"]);
    expect(posesForLifecycle("success")).toEqual(["thumbs", "celebrate"]);
    expect(posesForLifecycle("create")).toEqual(["magic", "paint"]);
    expect(posesForLifecycle("affection")).toEqual(["hearts"]);
    expect(posesForLifecycle("away")).toEqual(["night"]);
    expect(posesForLifecycle("idle", { hour: 23 })).toEqual(["night"]);
    expect(posesForLifecycle("idle", { hour: 8 })).toEqual(["hug", "wave"]);
    expect(posesForLifecycle("idle", { hour: 19 })).toEqual(["hug", "garden"]);
    expect(posesForLifecycle("idle", { hour: 23, timeOfDayPoses: false })).toEqual([
      "wave",
      "hug",
    ]);
    expect(posesForLifecycle("connecting")).toEqual(["think", "idea"]);
    expect(posesForLifecycle("error")).toEqual(["think", "idea"]);
  });

  it("resolves lock, auto-expression off, and tick-based pool picks", () => {
    expect(resolvePose("thinking", { lockPose: true, current: "hero" })).toBe("hero");
    expect(resolvePose("thinking", { lockPose: true, idlePose: "wave" })).toBe("wave");
    expect(resolvePose("thinking", { autoExpression: false, idlePose: "hero" })).toBe(
      "hero",
    );
    expect(resolvePose("away", { autoExpression: false, idlePose: "wave" })).toBe(
      "night",
    );
    expect(resolvePose("welcome")).toBe("hug");
    expect(resolvePose("thinking")).toBe("think");
    expect(resolvePose("thinking", { tick: 1 })).toBe("idea");
    expect(resolvePose("streaming")).toBe("think");
    expect(resolvePose("tool")).toBe("run");
    expect(resolvePose("success", { tick: 1 })).toBe("celebrate");
    expect(resolvePose("create")).toBe("magic");
    expect(poseForLifecycle("idle", { hour: 10, idlePose: "hearts" })).toBe("hearts");
  });

  it("skips the current pose when a pool has more than one option", () => {
    expect(pickFromPool(["wave", "hug"], 0, "wave")).toBe("hug");
    expect(pickFromPool(["wave", "hug"], 1, "hug")).toBe("wave");
    expect(pickFromPool(["hearts"], 0, "hearts")).toBe("hearts");
  });
});

describe("idle cycle and transitions", () => {
  const baseGate = {
    lockPose: false,
    autoExpression: true,
    dragging: false,
    lifecycle: "idle" as const,
    now: 20_000,
    manualHoldUntil: 0,
  };

  it("pauses idle cycling while locked, streaming, dragging, or held", () => {
    expect(shouldPauseIdleCycle(baseGate)).toBe(false);
    expect(shouldPauseIdleCycle({ ...baseGate, lifecycle: "welcome" })).toBe(false);
    expect(shouldPauseIdleCycle({ ...baseGate, lockPose: true })).toBe(true);
    expect(shouldPauseIdleCycle({ ...baseGate, autoExpression: false })).toBe(true);
    expect(shouldPauseIdleCycle({ ...baseGate, dragging: true })).toBe(true);
    expect(shouldPauseIdleCycle({ ...baseGate, lifecycle: "streaming" })).toBe(true);
    expect(shouldPauseIdleCycle({ ...baseGate, lifecycle: "success" })).toBe(true);
    expect(shouldPauseIdleCycle({ ...baseGate, manualHoldUntil: 25_000 })).toBe(true);
    expect(isBusyLifecycle("tool")).toBe(true);
    expect(isBusyLifecycle("idle")).toBe(false);
    expect(chatPoseTakesPriority("streaming")).toBe(true);
    expect(chatPoseTakesPriority("idle")).toBe(false);
  });

  it("cycles idle-friendly poses and stays on night after hours", () => {
    expect(nextIdlePose("wave", { tick: 0 })).toBe("hug");
    expect(nextIdlePose("hug", { tick: 1 })).toBe("wave");
    expect(nextIdlePose("wave", { tick: 0, hour: 23 })).toBe("night");
    expect(nextIdlePose("wave", { tick: 0, hour: 19 })).toBe("hug");
    expect(planCrossfade("wave", "hug")).toEqual({ from: "wave", to: "hug" });
    expect(planCrossfade("wave", "wave")).toBeNull();
  });

  it("evolves a long stream into the create lifecycle", () => {
    expect(evolveLifecycle("streaming", STREAM_TO_CREATE_MS - 1)).toBe("streaming");
    expect(evolveLifecycle("streaming", STREAM_TO_CREATE_MS)).toBe("create");
    expect(evolveLifecycle("thinking", STREAM_TO_CREATE_MS)).toBe("thinking");
  });
});

describe("activity and companion overlay", () => {
  const typing: ActivitySnapshot = {
    idleMs: 200,
    kind: "typing",
    source: "keyboard",
    available: true,
  };
  const mouse: ActivitySnapshot = {
    idleMs: 400,
    kind: "active",
    source: "mouse",
    available: true,
  };
  const longIdle: ActivitySnapshot = {
    idleMs: 500_000,
    kind: "idle",
    source: "unknown",
    available: true,
  };

  it("maps typing to think/paint and mouse to run/wave", () => {
    expect(
      poseFromActivity(typing, {
        idleThresholdMs: 50_000,
        longIdleThresholdMs: 420_000,
      }),
    ).toBe("think");
    expect(
      poseFromActivity(mouse, {
        idleThresholdMs: 50_000,
        longIdleThresholdMs: 420_000,
      }),
    ).toBe("run");
    expect(
      poseFromActivity(longIdle, {
        idleThresholdMs: 50_000,
        longIdleThresholdMs: 420_000,
      }),
    ).toBe("night");
  });

  it("lets chat streaming win over typing and respects pose lock", () => {
    expect(
      resolveCompanionPose({
        lifecycle: "streaming",
        activityAware: true,
        activity: typing,
      }),
    ).toBe("think");
    expect(
      resolveCompanionPose({
        lifecycle: "idle",
        activityAware: true,
        activity: mouse,
      }),
    ).toBe("run");
    expect(
      resolveCompanionPose({
        lifecycle: "idle",
        lockPose: true,
        current: "hero",
        activityAware: true,
        activity: typing,
      }),
    ).toBe("hero");
    expect(
      resolveCompanionPose({
        lifecycle: "tool",
        activityAware: true,
        activity: longIdle,
      }),
    ).toBe("run");
  });

  it("uses pomodoro poses when chat is idle", () => {
    expect(
      resolveCompanionPose({
        lifecycle: "idle",
        pomodoroPhase: "focus",
        activityAware: true,
        activity: mouse,
      }),
    ).toBe("think");
    expect(
      resolveCompanionPose({
        lifecycle: "idle",
        pomodoroPhase: "break",
      }),
    ).toBe("garden");
  });

  it("maps IDE foreground hints when enabled", () => {
    const ide: ActivitySnapshot = {
      idleMs: 100,
      kind: "active",
      source: "mouse",
      available: true,
      foreground: { title: "App", process: "Code.exe", category: "ide" },
    };
    expect(
      poseFromActivity(ide, {
        idleThresholdMs: 50_000,
        longIdleThresholdMs: 420_000,
        foregroundHints: true,
      }),
    ).toBe("think");
    expect(
      poseFromActivity(ide, {
        idleThresholdMs: 50_000,
        longIdleThresholdMs: 420_000,
        foregroundHints: false,
      }),
    ).toBe("run");
  });
});

describe("user-text pose hints", () => {
  it("detects thanks and generate wording", () => {
    expect(poseHintFromUserText("谢谢小元")).toBe("affection");
    expect(poseHintFromUserText("thanks a lot")).toBe("affection");
    expect(poseHintFromUserText("画一张星空")).toBe("create");
    expect(poseHintFromUserText("please generate a logo")).toBe("create");
    expect(poseHintFromUserText("今天天气怎么样")).toBeNull();
    expect(poseHintFromUserText("   ")).toBeNull();
  });
});

describe("pose preload cache", () => {
  afterEach(() => {
    resetPosePreloadCache();
    vi.unstubAllGlobals();
  });

  it("decodes each official PNG once", () => {
    const constructed: string[] = [];
    class FakeImage {
      decoding = "";
      set src(value: string) {
        constructed.push(value);
      }
    }
    vi.stubGlobal("Image", FakeImage);
    preloadPetPoses();
    preloadPetPoses();
    expect(constructed).toHaveLength(16);
    expect(constructed[0]).toBe("/mascots/wave.png");
    expect(constructed[15]).toBe("/mascots/night.png");
  });
});
