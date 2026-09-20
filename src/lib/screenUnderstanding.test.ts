import { afterEach, describe, expect, it } from "vitest";

import type { PixelStats, ScreenSample } from "./screenUnderstanding";
import {
  classifyFromStats,
  emptyPixelStats,
  heuristicAnalyze,
  looksLikeDarkIde,
  looksLikeVideoFullscreen,
  registerLocalScreenAnalyzer,
  SCREEN_UNDERSTANDING_IMPLEMENTED,
  screenshotAnalysisActive,
  screenUnderstandingActive,
  understandScreen,
} from "./screenUnderstanding";

function stats(partial: Partial<PixelStats>): PixelStats {
  return { ...emptyPixelStats(), captured: true, width: 160, height: 90, ...partial };
}

describe("screen understanding gates", () => {
  it("stays off unless the user opts in", () => {
    expect(SCREEN_UNDERSTANDING_IMPLEMENTED).toBe(true);
    expect(screenUnderstandingActive(undefined)).toBe(false);
    expect(screenUnderstandingActive(false)).toBe(false);
    expect(screenUnderstandingActive(true)).toBe(true);
    expect(screenshotAnalysisActive(true, false)).toBe(false);
    expect(screenshotAnalysisActive(false, true)).toBe(false);
    expect(screenshotAnalysisActive(true, true)).toBe(true);
  });
});

describe("local heuristics", () => {
  it("prefers window title/process over pixels", () => {
    const sample: ScreenSample = {
      title: "main.rs — xyai-xiaoyuan",
      process: "Code",
      category: "ide",
      capturedAt: 1,
      stats: stats({ darkRatio: 0.9, edgeScore: 0.02, meanLuma: 0.1 }),
    };
    const result = heuristicAnalyze(sample);
    expect(result.source).toBe("title");
    expect(result.category).toBe("ide");
    expect(result.reason).toMatch(/Code/);
  });

  it("detects a dark IDE-like frame and fullscreen video", () => {
    const ide = stats({
      darkRatio: 0.7,
      edgeScore: 0.22,
      chromaMean: 0.08,
      meanLuma: 0.24,
      colorVariance: 0.18,
    });
    const video = stats({
      darkRatio: 0.82,
      edgeScore: 0.04,
      colorVariance: 0.08,
      meanLuma: 0.12,
      chromaMean: 0.2,
    });
    expect(looksLikeDarkIde(ide)).toBe(true);
    expect(looksLikeVideoFullscreen(video)).toBe(true);
    expect(classifyFromStats(ide)).toBe("ide");
    expect(classifyFromStats(video)).toBe("media");
    expect(
      heuristicAnalyze({
        title: "Untitled",
        process: "app",
        category: "other",
        capturedAt: 2,
        stats: video,
      }).category,
    ).toBe("media");
  });
});

describe("local analyzer hook", () => {
  afterEach(() => {
    registerLocalScreenAnalyzer(null);
  });

  it("uses an in-process hook then falls back", async () => {
    const sample: ScreenSample = {
      title: "zoom",
      process: "zoom",
      category: "meeting",
      capturedAt: 3,
    };
    registerLocalScreenAnalyzer({
      id: "test-hook",
      analyze: () => ({
        category: "browser",
        source: "local-model",
        confidence: 0.9,
        reason: "hook",
      }),
    });
    const hooked = await understandScreen(sample);
    expect(hooked.source).toBe("local-model");
    expect(hooked.category).toBe("browser");

    registerLocalScreenAnalyzer({
      id: "empty",
      analyze: () => null,
    });
    const fallback = await understandScreen(sample);
    expect(fallback.source).toBe("title");
    expect(fallback.category).toBe("meeting");
  });
});
