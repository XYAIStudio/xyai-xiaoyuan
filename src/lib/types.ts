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
