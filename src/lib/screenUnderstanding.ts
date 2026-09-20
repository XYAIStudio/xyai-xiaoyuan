import type { AppCategory } from "./activity";
import type { PetPoseId } from "./mascots";

/**
 * Opt-in screen-content understanding.
 * Default OFF. Screenshots never leave the machine — no upload, no disk write.
 */
export const SCREEN_UNDERSTANDING_IMPLEMENTED = true;
export const SCREEN_CAPTURE_INTERVAL_MS = 12_000;

export interface PixelStats {
  width: number;
  height: number;
  /** 0–1 average luminance. */
  meanLuma: number;
  /** Fraction of pixels darker than ~0.22. */
  darkRatio: number;
  /** Fraction of pixels brighter than ~0.78. */
  brightRatio: number;
  /** 0–1 neighbor contrast (text/chrome vs flat video). */
  edgeScore: number;
  /** 0–1 luma standard deviation. */
  colorVariance: number;
  /** 0–1 mean chroma (max–min RGB). */
  chromaMean: number;
  captured: boolean;
}

export interface ScreenSample {
  title: string;
  process: string;
  category: AppCategory;
  capturedAt: number;
  stats?: PixelStats | null;
}

export type ScreenUnderstandingSource = "off" | "title" | "screenshot" | "local-model";

export interface ScreenUnderstandingResult {
  category: AppCategory;
  source: ScreenUnderstandingSource;
  confidence: number;
  reason: string;
}

export interface LocalScreenAnalyzer {
  id: string;
  /**
   * In-process only. Implementations must not upload pixels or titles.
   * Return null to fall back to the built-in heuristic.
   */
  analyze(
    sample: ScreenSample,
  ): ScreenUnderstandingResult | null | Promise<ScreenUnderstandingResult | null>;
}

let localAnalyzer: LocalScreenAnalyzer | null = null;

export function registerLocalScreenAnalyzer(next: LocalScreenAnalyzer | null): void {
  localAnalyzer = next;
}

export function registeredLocalScreenAnalyzer(): LocalScreenAnalyzer | null {
  return localAnalyzer;
}

export function screenUnderstandingActive(flag: boolean | undefined): boolean {
  return SCREEN_UNDERSTANDING_IMPLEMENTED && flag === true;
}

export function screenshotAnalysisActive(
  screenUnderstanding: boolean | undefined,
  allowScreenshot: boolean | undefined,
): boolean {
  return screenUnderstandingActive(screenUnderstanding) && allowScreenshot === true;
}

export function emptyPixelStats(): PixelStats {
  return {
    width: 0,
    height: 0,
    meanLuma: 0,
    darkRatio: 0,
    brightRatio: 0,
    edgeScore: 0,
    colorVariance: 0,
    chromaMean: 0,
    captured: false,
  };
}

/** Dark IDE-like chrome: dim UI, readable edges, low saturation. */
export function looksLikeDarkIde(stats: PixelStats): boolean {
  if (!stats.captured) return false;
  return (
    stats.darkRatio >= 0.52 &&
    stats.edgeScore >= 0.14 &&
    stats.chromaMean <= 0.24 &&
    stats.meanLuma <= 0.42
  );
}

/** Fullscreen video / media: large flat regions, few text edges. */
export function looksLikeVideoFullscreen(stats: PixelStats): boolean {
  if (!stats.captured) return false;
  const flat = stats.edgeScore <= 0.11 && stats.colorVariance <= 0.2;
  const cinematic = stats.darkRatio >= 0.68 && flat;
  const washed = stats.brightRatio >= 0.55 && stats.edgeScore <= 0.08;
  return cinematic || washed;
}

export function classifyFromStats(
  stats: PixelStats | null | undefined,
): AppCategory | null {
  if (!stats?.captured) return null;
  if (looksLikeVideoFullscreen(stats)) return "media";
  if (looksLikeDarkIde(stats)) return "ide";
  if (stats.brightRatio >= 0.3 && stats.edgeScore >= 0.12 && stats.chromaMean >= 0.12) {
    return "browser";
  }
  return null;
}

export function heuristicAnalyze(sample: ScreenSample): ScreenUnderstandingResult {
  const titled =
    sample.category === "ide" ||
    sample.category === "browser" ||
    sample.category === "meeting" ||
    sample.category === "media";
  if (titled) {
    return {
      category: sample.category,
      source: "title",
      confidence: 0.86,
      reason: `前台窗口「${sample.process || sample.title || "未知"}」`,
    };
  }
  const fromPixels = classifyFromStats(sample.stats);
  if (fromPixels) {
    return {
      category: fromPixels,
      source: "screenshot",
      confidence: fromPixels === "media" ? 0.72 : 0.64,
      reason:
        fromPixels === "ide"
          ? "本机截图像深色编辑器"
          : fromPixels === "media"
            ? "本机截图像全屏影像"
            : "本机截图像浏览页面",
    };
  }
  return {
    category: sample.category === "other" ? "other" : "unknown",
    source: sample.stats?.captured ? "screenshot" : "title",
    confidence: 0.2,
    reason: "未能从标题或截图特征判断场景",
  };
}

export async function understandScreen(
  sample: ScreenSample,
): Promise<ScreenUnderstandingResult> {
  const fallback = heuristicAnalyze(sample);
  if (!localAnalyzer) return fallback;
  try {
    const hooked = await localAnalyzer.analyze(sample);
    if (!hooked) return fallback;
    return { ...hooked, source: "local-model" };
  } catch {
    return fallback;
  }
}

export function poseForScreenCategory(category: AppCategory): PetPoseId[] | null {
  switch (category) {
    case "ide":
      return ["think", "paint"];
    case "browser":
      return ["explore", "idea"];
    case "meeting":
      return ["wave", "hero"];
    case "media":
      return ["music", "party"];
    default:
      return null;
  }
}

export const SCREEN_PRIVACY_NOTE_ZH =
  "默认关闭。开启后只在本机读取前台窗口标题与进程名，用来猜测你在写代码、浏览、开会或看视频。勾选「允许截屏分析」才会拍摄缩小截图并做亮度/边缘启发式判断。截图不写磁盘、不上传、不发给任何后端或云端模型。对话流式与锁定姿态优先于屏幕理解。";
