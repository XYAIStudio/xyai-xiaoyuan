import { parseHhMm } from "./audio";
import {
  DEFAULT_IDLE_THRESHOLD_SEC,
  DEFAULT_LONG_IDLE_THRESHOLD_SEC,
} from "./activity";
import { clampMood, MOOD_DEFAULT } from "./mood";
import { clampMinutes } from "./pomodoro";
import type { AppConfig, MonitorPosition } from "./types";
import { isPetPoseId } from "./mascots";
import { safeProviderId } from "./providers/registry";

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function clampRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampRange(value, min, max, fallback));
}

function asHhMm(value: unknown, fallback: string): string {
  if (typeof value === "string" && parseHhMm(value) != null) return value;
  return fallback;
}

function asPositions(raw: unknown): Record<string, MonitorPosition> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, MonitorPosition> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const row = value as { x?: unknown; y?: unknown };
    const x = Number(row.x);
    const y = Number(row.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out[key] = { x, y };
  }
  return out;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  providerId: "freeos",
  freeos: {
    baseUrl: "http://127.0.0.1:8088",
    username: "",
  },
  openxyos: {
    baseUrl: "http://127.0.0.1:3000",
    email: "",
  },
  xyaiStudio: {
    baseUrl: "",
  },
  grokbot: {
    baseUrl: "http://127.0.0.1:1340",
    gatewayJsonPath: "",
  },
  providerOptions: {},
  mascotId: "wave",
  autoExpression: true,
  lockPose: false,
  lastAgentId: null,
  threadIdByAgent: {},
  petX: null,
  petY: null,
  petSize: 180,
  shortcutOpenPet: "CmdOrCtrl+Shift+Y",
  shortcutOpenHome: "CmdOrCtrl+Shift+H",
  keepWindowsVisible: true,
  activityAware: true,
  idleThresholdSec: DEFAULT_IDLE_THRESHOLD_SEC,
  longIdleThresholdSec: DEFAULT_LONG_IDLE_THRESHOLD_SEC,
  foregroundHints: false,
  timeOfDayPoses: true,
  petOpacity: 100,
  alwaysOnTop: true,
  clickThrough: false,
  edgeSnap: true,
  petPositionByMonitor: {},
  autostart: false,
  soundEnabled: false,
  sfxEnabled: true,
  musicEnabled: false,
  soundVolume: 40,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  pomodoroFocusMin: 25,
  pomodoroBreakMin: 5,
  pomodoroLongBreakMin: 15,
  moodMeterEnabled: true,
  moodEnergy: MOOD_DEFAULT,
  screenUnderstanding: false,
  shortcutOpenChat: "CmdOrCtrl+Shift+C",
  shortcutToggleClickThrough: "CmdOrCtrl+Shift+T",
  shortcutPomodoro: "CmdOrCtrl+Shift+P",
};

export function normalizeLoadedConfig(
  raw: Partial<AppConfig> | null | undefined,
): AppConfig {
  const merged: AppConfig = {
    ...DEFAULT_APP_CONFIG,
    ...raw,
    freeos: { ...DEFAULT_APP_CONFIG.freeos, ...raw?.freeos },
    openxyos: { ...DEFAULT_APP_CONFIG.openxyos, ...raw?.openxyos },
    xyaiStudio: { ...DEFAULT_APP_CONFIG.xyaiStudio, ...raw?.xyaiStudio },
    grokbot: { ...DEFAULT_APP_CONFIG.grokbot, ...raw?.grokbot },
    providerOptions: { ...DEFAULT_APP_CONFIG.providerOptions, ...raw?.providerOptions },
    threadIdByAgent: { ...DEFAULT_APP_CONFIG.threadIdByAgent, ...raw?.threadIdByAgent },
    petPositionByMonitor: {
      ...DEFAULT_APP_CONFIG.petPositionByMonitor,
      ...asPositions(raw?.petPositionByMonitor),
    },
  };
  merged.providerId = safeProviderId(merged.providerId);
  if (!isPetPoseId(merged.mascotId)) merged.mascotId = "wave";
  merged.lockPose = asBool(merged.lockPose, false);
  merged.autoExpression = asBool(merged.autoExpression, true);
  const size = typeof merged.petSize === "number" ? merged.petSize : 180;
  merged.petSize = size >= 80 && size <= 224 ? size : 180;
  merged.activityAware = asBool(merged.activityAware, true);
  merged.idleThresholdSec = clampInt(
    merged.idleThresholdSec,
    10,
    600,
    DEFAULT_IDLE_THRESHOLD_SEC,
  );
  merged.longIdleThresholdSec = clampInt(
    merged.longIdleThresholdSec,
    60,
    3600,
    DEFAULT_LONG_IDLE_THRESHOLD_SEC,
  );
  if (merged.longIdleThresholdSec < merged.idleThresholdSec) {
    merged.longIdleThresholdSec = Math.min(3600, merged.idleThresholdSec * 6);
  }
  merged.foregroundHints = asBool(merged.foregroundHints, false);
  merged.timeOfDayPoses = asBool(merged.timeOfDayPoses, true);
  merged.petOpacity = clampInt(merged.petOpacity, 40, 100, 100);
  merged.alwaysOnTop = asBool(merged.alwaysOnTop, true);
  merged.clickThrough = asBool(merged.clickThrough, false);
  merged.edgeSnap = asBool(merged.edgeSnap, true);
  merged.autostart = asBool(merged.autostart, false);
  merged.soundEnabled = asBool(merged.soundEnabled, false);
  merged.sfxEnabled = asBool(merged.sfxEnabled, true);
  merged.musicEnabled = asBool(merged.musicEnabled, false);
  merged.soundVolume = clampInt(merged.soundVolume, 0, 100, 40);
  merged.quietHoursEnabled = asBool(merged.quietHoursEnabled, false);
  merged.quietHoursStart = asHhMm(merged.quietHoursStart, "22:00");
  merged.quietHoursEnd = asHhMm(merged.quietHoursEnd, "07:00");
  merged.pomodoroFocusMin = clampMinutes(merged.pomodoroFocusMin, 25);
  merged.pomodoroBreakMin = clampMinutes(merged.pomodoroBreakMin, 5);
  merged.pomodoroLongBreakMin = clampMinutes(merged.pomodoroLongBreakMin, 15);
  merged.moodMeterEnabled = asBool(merged.moodMeterEnabled, true);
  merged.moodEnergy = clampMood(merged.moodEnergy);
  merged.screenUnderstanding = asBool(merged.screenUnderstanding, false);
  merged.shortcutOpenPet = asString(merged.shortcutOpenPet, "CmdOrCtrl+Shift+Y");
  merged.shortcutOpenHome = asString(merged.shortcutOpenHome, "CmdOrCtrl+Shift+H");
  merged.shortcutOpenChat = asString(merged.shortcutOpenChat, "CmdOrCtrl+Shift+C");
  merged.shortcutToggleClickThrough = asString(
    merged.shortcutToggleClickThrough,
    "CmdOrCtrl+Shift+T",
  );
  merged.shortcutPomodoro = asString(merged.shortcutPomodoro, "CmdOrCtrl+Shift+P");
  merged.keepWindowsVisible = asBool(merged.keepWindowsVisible, true);
  return merged;
}

export function audioSettingsOf(cfg: AppConfig) {
  return {
    soundEnabled: cfg.soundEnabled,
    sfxEnabled: cfg.sfxEnabled,
    musicEnabled: cfg.musicEnabled,
    soundVolume: cfg.soundVolume,
    quietHoursEnabled: cfg.quietHoursEnabled,
    quietHoursStart: cfg.quietHoursStart,
    quietHoursEnd: cfg.quietHoursEnd,
  };
}

export function pomodoroSettingsOf(cfg: AppConfig) {
  return {
    focusMin: cfg.pomodoroFocusMin,
    breakMin: cfg.pomodoroBreakMin,
    longBreakMin: cfg.pomodoroLongBreakMin,
  };
}

export function activeBaseUrl(cfg: AppConfig): string {
  switch (cfg.providerId) {
    case "openxyos":
      return cfg.openxyos.baseUrl;
    case "xyai-studio":
      return cfg.xyaiStudio.baseUrl;
    case "grokbot":
      return cfg.grokbot.baseUrl;
    default:
      return cfg.freeos.baseUrl;
  }
}

export function activeUsername(cfg: AppConfig): string {
  switch (cfg.providerId) {
    case "openxyos":
      return cfg.openxyos.email;
    case "freeos":
      return cfg.freeos.username;
    default:
      return "";
  }
}

export function resolveThreadForAgent(cfg: AppConfig, agentId: string): string | null {
  return cfg.threadIdByAgent[agentId] ?? null;
}

export function withThreadForAgent(
  cfg: AppConfig,
  agentId: string,
  threadId: string,
): AppConfig {
  return {
    ...cfg,
    lastAgentId: agentId,
    threadIdByAgent: { ...cfg.threadIdByAgent, [agentId]: threadId },
  };
}
