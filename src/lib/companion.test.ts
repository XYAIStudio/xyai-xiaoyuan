import { describe, expect, it } from "vitest";

import { categorizeForeground, classifyActivity, snapshotFromRaw } from "./activity";
import { isQuietHours, musicAllowed, parseHhMm, playSfx, sfxAllowed } from "./audio";
import { bumpMood, clampMood, decayMood, moodLabelZh } from "./mood";
import {
  formatRemaining,
  idlePomodoro,
  skipPhase,
  startFocus,
  tickPomodoro,
  togglePomodoro,
} from "./pomodoro";
import { dayPeriodFromHour } from "./timeOfDay";
import {
  isDragFromDelta,
  nextPlayfulPose,
  poseForFeed,
  poseForPat,
} from "./petInteractions";
import { DEFAULT_APP_CONFIG, normalizeLoadedConfig } from "./configLogic";
import { screenUnderstandingActive } from "./screenUnderstanding";
import { makeToast, toastDurationMs } from "./notifications";

describe("activity classification", () => {
  it("treats recent keyboard as typing and long gaps as idle", () => {
    expect(classifyActivity(200, "keyboard", 50_000)).toBe("typing");
    expect(classifyActivity(200, "mouse", 50_000)).toBe("active");
    expect(classifyActivity(80_000, "keyboard", 50_000)).toBe("idle");
    expect(classifyActivity(0, "unavailable", 50_000)).toBe("idle");
  });

  it("categorizes common Windows process names", () => {
    expect(categorizeForeground("Code.exe", "main.ts")).toBe("ide");
    expect(categorizeForeground("chrome", "GitHub")).toBe("browser");
    expect(categorizeForeground("Zoom.exe", "Meeting")).toBe("meeting");
    expect(categorizeForeground("Spotify.exe", "")).toBe("media");
    expect(categorizeForeground("notepad", "todo")).toBe("other");
  });

  it("builds a snapshot with idle kind from raw last-input", () => {
    const snap = snapshotFromRaw(
      { idleMs: 12, source: "keyboard", available: true },
      50_000,
    );
    expect(snap.kind).toBe("typing");
    expect(snap.available).toBe(true);
  });
});

describe("audio gates", () => {
  const base = {
    soundEnabled: true,
    sfxEnabled: true,
    musicEnabled: true,
    soundVolume: 40,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
  };

  it("parses quiet-hour windows that wrap midnight", () => {
    expect(parseHhMm("22:00")).toBe(22 * 60);
    expect(isQuietHours(23 * 60, "22:00", "07:00")).toBe(true);
    expect(isQuietHours(8 * 60, "22:00", "07:00")).toBe(false);
    expect(isQuietHours(13 * 60, "12:00", "14:00")).toBe(true);
  });

  it("blocks sfx when master is off or during quiet hours", () => {
    expect(sfxAllowed({ ...base, soundEnabled: false })).toBe(false);
    expect(sfxAllowed({ ...base, sfxEnabled: false })).toBe(false);
    expect(
      sfxAllowed({ ...base, quietHoursEnabled: true }, new Date(2026, 0, 1, 23, 0, 0)),
    ).toBe(false);
    expect(sfxAllowed(base, new Date(2026, 0, 1, 12, 0, 0))).toBe(true);
    expect(
      musicAllowed(
        { ...base, quietHoursEnabled: true, musicEnabled: true },
        new Date(2026, 0, 1, 23, 30, 0),
      ),
    ).toBe(false);
  });

  it("playSfx no-ops without Audio and when disabled", () => {
    expect(() => playSfx("pat", { ...base, soundEnabled: false })).not.toThrow();
  });
});

describe("mood meter", () => {
  it("decays with idle and rises with interaction", () => {
    expect(decayMood(64, 10_000)).toBe(64);
    expect(decayMood(64, 50_000)).toBe(63);
    expect(bumpMood(64, "pat")).toBe(74);
    expect(clampMood(200)).toBe(100);
    expect(moodLabelZh(90)).toBe("元气满满");
    expect(moodLabelZh(20)).toBe("想休息");
  });
});

describe("pomodoro", () => {
  const settings = { focusMin: 25, breakMin: 5, longBreakMin: 15 };

  it("starts focus, then flips to break when the timer elapses", () => {
    const started = startFocus(1_000, settings);
    expect(started.phase).toBe("focus");
    expect(formatRemaining(remainingFor(started, 1_000))).toBe("25:00");
    const still = tickPomodoro(started, 1_000 + 60_000, settings);
    expect(still.phaseChanged).toBe(false);
    const done = tickPomodoro(started, 1_000 + 25 * 60_000, settings);
    expect(done.phaseChanged).toBe(true);
    expect(done.state.phase).toBe("break");
    expect(done.state.focusCount).toBe(1);
  });

  it("takes a long break every four focuses and toggle stops", () => {
    let state = startFocus(0, settings, 3);
    const after = tickPomodoro(state, 25 * 60_000, settings);
    expect(after.state.phase).toBe("longBreak");
    state = skipPhase(idlePomodoro(), 0, settings);
    expect(state.phase).toBe("focus");
    expect(togglePomodoro(state, 0, settings).phase).toBe("idle");
  });
});

function remainingFor(state: ReturnType<typeof startFocus>, now: number): number {
  return Math.max(0, (state.endsAt ?? 0) - now);
}

describe("time of day and click toys", () => {
  it("buckets local hours", () => {
    expect(dayPeriodFromHour(7)).toBe("morning");
    expect(dayPeriodFromHour(15)).toBe("day");
    expect(dayPeriodFromHour(20)).toBe("evening");
    expect(dayPeriodFromHour(2)).toBe("night");
  });

  it("cycles playful poses and maps pat/feed", () => {
    expect(nextPlayfulPose("wave", 0)).toBe("party");
    expect(poseForPat()).toBe("hearts");
    expect(poseForFeed()).toBe("garden");
    expect(isDragFromDelta(5, 0)).toBe(true);
    expect(isDragFromDelta(1, 1)).toBe(false);
  });
});

describe("config companion defaults", () => {
  it("turns activity on, sound master off, and clamps thresholds", () => {
    expect(DEFAULT_APP_CONFIG.activityAware).toBe(true);
    expect(DEFAULT_APP_CONFIG.soundEnabled).toBe(false);
    expect(DEFAULT_APP_CONFIG.sfxEnabled).toBe(true);
    expect(DEFAULT_APP_CONFIG.foregroundHints).toBe(false);
    expect(DEFAULT_APP_CONFIG.screenUnderstanding).toBe(false);
    const loaded = normalizeLoadedConfig({
      idleThresholdSec: 3,
      petOpacity: 9,
      soundVolume: 400,
      quietHoursStart: "nope",
    } as never);
    expect(loaded.idleThresholdSec).toBe(10);
    expect(loaded.petOpacity).toBe(40);
    expect(loaded.soundVolume).toBe(100);
    expect(loaded.quietHoursStart).toBe("22:00");
    expect(screenUnderstandingActive(true)).toBe(false);
  });
});

describe("toasts", () => {
  it("clips copy and scales duration", () => {
    const toast = makeToast("  后端已重新连接  ", "ok");
    expect(toast.tone).toBe("ok");
    expect(toast.text).toBe("后端已重新连接");
    expect(toastDurationMs("hi")).toBeGreaterThan(1800);
  });
});
