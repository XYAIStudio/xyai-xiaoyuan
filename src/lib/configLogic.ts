import type { AppConfig } from "./types";
import { isPetPoseId } from "./mascots";
import { safeProviderId } from "./providers/registry";

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
  lastAgentId: null,
  threadIdByAgent: {},
  petX: null,
  petY: null,
  petSize: 180,
  shortcutOpenPet: "CmdOrCtrl+Shift+Y",
  shortcutOpenHome: "CmdOrCtrl+Shift+H",
  keepWindowsVisible: true,
};

export function normalizeLoadedConfig(raw: Partial<AppConfig> | null | undefined): AppConfig {
  const merged: AppConfig = {
    ...DEFAULT_APP_CONFIG,
    ...raw,
    freeos: { ...DEFAULT_APP_CONFIG.freeos, ...raw?.freeos },
    openxyos: { ...DEFAULT_APP_CONFIG.openxyos, ...raw?.openxyos },
    xyaiStudio: { ...DEFAULT_APP_CONFIG.xyaiStudio, ...raw?.xyaiStudio },
    grokbot: { ...DEFAULT_APP_CONFIG.grokbot, ...raw?.grokbot },
    providerOptions: { ...DEFAULT_APP_CONFIG.providerOptions, ...raw?.providerOptions },
    threadIdByAgent: { ...DEFAULT_APP_CONFIG.threadIdByAgent, ...raw?.threadIdByAgent },
  };
  merged.providerId = safeProviderId(merged.providerId);
  if (!isPetPoseId(merged.mascotId)) merged.mascotId = "wave";
  if (!(merged.petSize >= 80 && merged.petSize <= 224)) merged.petSize = 180;
  return merged;
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
