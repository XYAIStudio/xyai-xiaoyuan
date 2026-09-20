import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

import { DEFAULT_APP_CONFIG, normalizeLoadedConfig } from "./configLogic";
import type { PetPoseId } from "./mascots";
import type { AppConfig } from "./types";

const STORAGE_KEY = "xyai-xiaoyuan-config";
const SECRET_PREFIX = "xyai-xiaoyuan-secret:";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const memorySecrets = new Map<string, string>();

function browserLoadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeLoadedConfig(raw ? (JSON.parse(raw) as Partial<AppConfig>) : {});
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}

function browserSaveConfig(cfg: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export const tauriApi = {
  loadConfig: async () => {
    if (!isTauri()) return browserLoadConfig();
    return normalizeLoadedConfig(await invoke<AppConfig>("load_config"));
  },
  saveConfig: async (cfg: AppConfig) => {
    if (!isTauri()) {
      browserSaveConfig(cfg);
      return;
    }
    await invoke("save_config", { cfg });
  },
  patchConfig: async (patch: Record<string, unknown>) => {
    if (!isTauri()) {
      const next = normalizeLoadedConfig({ ...browserLoadConfig(), ...patch } as Partial<AppConfig>);
      browserSaveConfig(next);
      return;
    }
    await invoke("patch_config", { patch });
  },
  getSecret: async (key: string) => {
    if (!isTauri()) {
      return memorySecrets.get(key) ?? localStorage.getItem(SECRET_PREFIX + key);
    }
    return invoke<string | null>("get_secret", { key });
  },
  setSecret: async (key: string, value: string) => {
    if (!isTauri()) {
      memorySecrets.set(key, value);
      localStorage.setItem(SECRET_PREFIX + key, value);
      return;
    }
    await invoke("set_secret", { key, value });
  },
  deleteSecret: async (key: string) => {
    if (!isTauri()) {
      memorySecrets.delete(key);
      localStorage.removeItem(SECRET_PREFIX + key);
      return;
    }
    await invoke("delete_secret", { key });
  },
  openHome: async (baseUrl: string) => {
    if (!isTauri()) {
      window.open(baseUrl, "_blank");
      return;
    }
    await invoke("open_home", { baseUrl });
  },
  showChatNearPet: () =>
    isTauri() ? invoke("show_chat_near_pet") : Promise.resolve(),
  hideChat: () => (isTauri() ? invoke("hide_chat") : Promise.resolve()),
  hidePet: () => (isTauri() ? invoke("hide_pet") : Promise.resolve()),
  showSettings: () => (isTauri() ? invoke("show_settings") : Promise.resolve()),
  quitApp: () => (isTauri() ? invoke("quit_app") : Promise.resolve()),
  reloadHotkeys: () => (isTauri() ? invoke("reload_hotkeys") : Promise.resolve()),
  importGatewayJson: (path: string) =>
    isTauri()
      ? invoke<{ baseUrl: string; hasToken: boolean }>("import_gateway_json", { path })
      : Promise.reject(new Error("仅桌面端可读取 gateway.json")),
  emitAuthUpdated: () => emit("auth-updated"),
  listenAuthUpdated: (handler: () => void) => listen("auth-updated", handler),
  listenChatShown: (handler: () => void) => listen("chat-shown", handler),
  emitMascotChanged: (mascotId: PetPoseId) => emit("mascot-changed", mascotId),
  listenMascotChanged: (handler: (mascotId: PetPoseId) => void) =>
    listen<PetPoseId>("mascot-changed", ({ payload }) => handler(payload)),
  emitPetLifecycle: (life: string) => emit("pet-lifecycle", life),
  listenPetLifecycle: (handler: (life: string) => void) =>
    listen<string>("pet-lifecycle", ({ payload }) => handler(payload)),
};
