import type { PetPoseId } from "./mascots";
import type { ProviderId } from "./providers/types";

export type { PetPoseId };

export interface FreeOsSettings {
  baseUrl: string;
  username: string;
}

export interface OpenXyosSettings {
  baseUrl: string;
  email: string;
}

export interface XyaiStudioSettings {
  baseUrl: string;
}

export interface GrokBotSettings {
  baseUrl: string;
  gatewayJsonPath: string;
}

export interface MonitorPosition {
  x: number;
  y: number;
}

export interface AppConfig {
  providerId: ProviderId;
  freeos: FreeOsSettings;
  openxyos: OpenXyosSettings;
  xyaiStudio: XyaiStudioSettings;
  grokbot: GrokBotSettings;
  /** Opaque options for XYAIStudio backends added later without dedicated structs. */
  providerOptions: Record<string, Record<string, unknown>>;
  mascotId: PetPoseId;
  autoExpression: boolean;
  /** Freeze the current pose until the user unlocks it. */
  lockPose: boolean;
  lastAgentId: string | null;
  threadIdByAgent: Record<string, string>;
  petX: number | null;
  petY: number | null;
  petSize: number;
  shortcutOpenPet: string;
  shortcutOpenHome: string;
  keepWindowsVisible: boolean;

  /** Drive poses from keyboard/mouse last-input. Default on. */
  activityAware: boolean;
  idleThresholdSec: number;
  longIdleThresholdSec: number;
  /** Optional process/title category → pose. Default off (privacy). */
  foregroundHints: boolean;
  /** Morning / evening / night pools from the local clock. Default on. */
  timeOfDayPoses: boolean;

  petOpacity: number;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  edgeSnap: boolean;
  petPositionByMonitor: Record<string, MonitorPosition>;

  autostart: boolean;

  soundEnabled: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  pomodoroFocusMin: number;
  pomodoroBreakMin: number;
  pomodoroLongBreakMin: number;

  moodMeterEnabled: boolean;
  moodEnergy: number;

  /**
   * Future screenshot/OCR module. Persisted but inert — never captures in this build.
   */
  screenUnderstanding: boolean;

  shortcutOpenChat: string;
  shortcutToggleClickThrough: string;
  shortcutPomodoro: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  state?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pending?: boolean;
  error?: string;
}
