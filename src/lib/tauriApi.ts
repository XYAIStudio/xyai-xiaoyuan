import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

import {
  ACTIVITY_POLL_MS,
  browserActivitySnapshot,
  snapshotFromRaw,
  type ActivitySnapshot,
  type InputSource,
} from "./activity";
import { DEFAULT_APP_CONFIG, normalizeLoadedConfig } from "./configLogic";
import type { PetPoseId } from "./mascots";
import { makeToast, type PetToast, type ToastTone } from "./notifications";
import type { CompanionAction } from "./companionLines";
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
  applyPetWindow: () => (isTauri() ? invoke("apply_pet_window") : Promise.resolve()),
  clampPetToWorkArea: (snap?: boolean) =>
    isTauri() ? invoke("clamp_pet_to_work_area", { snap }) : Promise.resolve(),
  isChatVisible: async () => {
    if (!isTauri()) return false;
    try {
      return await invoke<boolean>("is_chat_visible");
    } catch {
      return false;
    }
  },
  focusChat: () => (isTauri() ? invoke("focus_chat") : Promise.resolve()),
  setPetClickThrough: (enabled: boolean) =>
    isTauri() ? invoke("set_pet_click_through", { enabled }) : Promise.resolve(),
  toggleClickThrough: () =>
    isTauri() ? invoke<boolean>("toggle_click_through") : Promise.resolve(false),
  setAutostart: async (enabled: boolean) => {
    if (!isTauri()) return enabled;
    return invoke<boolean>("set_autostart", { enabled });
  },
  isAutostart: async () => {
    if (!isTauri()) return false;
    try {
      return await invoke<boolean>("is_autostart");
    } catch {
      return false;
    }
  },
  setTrayTooltip: async (text: string) => {
    if (!isTauri()) return;
    try {
      await invoke("set_tray_tooltip", { text });
    } catch {
      /* tray may be missing in tests */
    }
  },
  getActivitySnapshot: async (
    options: { includeForeground?: boolean; idleThresholdMs?: number } = {},
  ): Promise<ActivitySnapshot> => {
    const idleMs =
      options.idleThresholdMs ?? DEFAULT_APP_CONFIG.idleThresholdSec * 1000;
    if (!isTauri()) return browserActivitySnapshot(idleMs);
    try {
      const raw = await invoke<{
        idleMs: number;
        source: InputSource;
        available: boolean;
        foreground?: { title: string; process: string; category?: string };
      }>("get_activity_snapshot", {
        includeForeground: options.includeForeground ?? false,
      });
      return snapshotFromRaw(raw, idleMs);
    } catch {
      return {
        idleMs: 0,
        kind: "idle",
        source: "unavailable",
        available: false,
      };
    }
  },
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
  emitPetToast: (text: string, tone: ToastTone = "info") =>
    emitEvent("pet-toast", makeToast(text, tone)),
  listenPetToast: (handler: (toast: PetToast) => void) =>
    listenEvent<{ text?: string; tone?: ToastTone; id?: string }>(
      "pet-toast",
      (raw) => {
        if (raw && typeof raw.text === "string") {
          handler({
            id: raw.id || makeToast(raw.text, raw.tone).id,
            text: raw.text,
            tone: raw.tone ?? "info",
          });
        }
      },
    ),
  emitPomodoroToggle: () => emitEvent("pomodoro-toggle"),
  listenPomodoroToggle: (handler: () => void) =>
    listenEvent("pomodoro-toggle", handler),
  emitPomodoroSkip: () => emitEvent("pomodoro-skip"),
  listenPomodoroSkip: (handler: () => void) => listenEvent("pomodoro-skip", handler),
  emitPomodoroUpdated: (payload: unknown) => emitEvent("pomodoro-updated", payload),
  listenPomodoroUpdated: <T>(handler: (payload: T) => void) =>
    listenEvent<T>("pomodoro-updated", handler),
  emitCompanionAction: (action: CompanionAction) =>
    emitEvent("companion-action", action),
  listenCompanionAction: (handler: (action: CompanionAction) => void) =>
    listenEvent<CompanionAction>("companion-action", (raw) => {
      if (raw === "pat" || raw === "feed" || raw === "night") handler(raw);
    }),
  activityPollMs: ACTIVITY_POLL_MS,
};
