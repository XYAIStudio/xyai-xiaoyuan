import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

import { DEFAULT_APP_CONFIG, normalizeLoadedConfig } from "./configLogic";
import type { PetPoseId } from "./mascots";
import type { AppConfig } from "./types";

const STORAGE_KEY = "xyai-xiaoyuan-config";
const SECRET_PREFIX = "xyai-xiaoyuan-secret:";
const BUS_NAME = "xyai-xiaoyuan";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let broadcast: BroadcastChannel | null = null;

function bus(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!broadcast) broadcast = new BroadcastChannel(BUS_NAME);
  return broadcast;
}

function emitLocal(name: string, payload?: unknown): Promise<void> {
  window.dispatchEvent(new CustomEvent(`xyai:${name}`, { detail: payload }));
  bus()?.postMessage({ name, payload });
  return Promise.resolve();
}

function listenLocal<T>(
  name: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  const local = (event: Event) => handler((event as CustomEvent).detail as T);
  window.addEventListener(`xyai:${name}`, local);
  const channel = bus();
  const remote = (event: MessageEvent) => {
    if (event.data?.name === name) handler(event.data.payload as T);
  };
  channel?.addEventListener("message", remote);
  return Promise.resolve(() => {
    window.removeEventListener(`xyai:${name}`, local);
    channel?.removeEventListener("message", remote);
  });
}

function emitEvent(name: string, payload?: unknown): Promise<void> {
  if (!isTauri()) return emitLocal(name, payload);
  return emit(name, payload);
}

function listenEvent<T>(
  name: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (!isTauri()) return listenLocal(name, handler);
  return listen<T>(name, ({ payload }) => handler(payload)).then((unlisten) => () => {
    unlisten();
  });
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
      const next = normalizeLoadedConfig({
        ...browserLoadConfig(),
        ...patch,
      } as Partial<AppConfig>);
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
  showChatNearPet: () => (isTauri() ? invoke("show_chat_near_pet") : Promise.resolve()),
  hideChat: () => (isTauri() ? invoke("hide_chat") : Promise.resolve()),
  hidePet: () => (isTauri() ? invoke("hide_pet") : Promise.resolve()),
  showSettings: () => (isTauri() ? invoke("show_settings") : Promise.resolve()),
  quitApp: () => (isTauri() ? invoke("quit_app") : Promise.resolve()),
  reloadHotkeys: () => (isTauri() ? invoke("reload_hotkeys") : Promise.resolve()),
  importGatewayJson: (path: string) =>
    isTauri()
      ? invoke<{ baseUrl: string; hasToken: boolean }>("import_gateway_json", { path })
      : Promise.reject(new Error("仅桌面端可读取 gateway.json")),
  emitAuthUpdated: () => emitEvent("auth-updated"),
  listenAuthUpdated: (handler: () => void) => listenEvent("auth-updated", handler),
  listenChatShown: (handler: () => void) => listenEvent("chat-shown", handler),
  emitMascotChanged: (mascotId: PetPoseId) => emitEvent("mascot-changed", mascotId),
  listenMascotChanged: (handler: (mascotId: PetPoseId) => void) =>
    listenEvent<PetPoseId>("mascot-changed", handler),
  emitPetLifecycle: (life: string) => emitEvent("pet-lifecycle", life),
  listenPetLifecycle: (handler: (life: string) => void) =>
    listenEvent<string>("pet-lifecycle", handler),
  emitConfigUpdated: () => emitEvent("config-updated"),
  listenConfigUpdated: (handler: () => void) => listenEvent("config-updated", handler),
  listenCheckUpdates: (handler: () => void) => listenEvent("check-updates", handler),
};
