export type ActivityKind = "idle" | "active" | "typing";
export type InputSource = "keyboard" | "mouse" | "unknown" | "unavailable";
export type AppCategory = "ide" | "browser" | "meeting" | "media" | "other" | "unknown";

export const ACTIVITY_POLL_MS = 750;
export const DEFAULT_IDLE_THRESHOLD_SEC = 50;
export const DEFAULT_LONG_IDLE_THRESHOLD_SEC = 420;
/** Burst of keys within this window maps to think/paint. */
export const TYPING_BURST_MS = 1_200;

export interface ForegroundApp {
  title: string;
  process: string;
  category: AppCategory;
}

export interface ActivitySnapshot {
  idleMs: number;
  kind: ActivityKind;
  source: InputSource;
  available: boolean;
  foreground?: ForegroundApp;
}

const IDE_HINTS = [
  "code",
  "cursor",
  "vscode",
  "devenv",
  "idea",
  "pycharm",
  "webstorm",
  "goland",
  "clion",
  "rustrover",
  "sublime",
  "nvim",
  "vim",
  "emacs",
  "xcode",
  "android studio",
  "zed",
  "windsurf",
  "visual studio",
  "jetbrains",
];

const BROWSER_HINTS = [
  "chrome",
  "firefox",
  "msedge",
  "edge",
  "safari",
  "brave",
  "opera",
  "vivaldi",
  "chromium",
  "arc",
];

const MEETING_HINTS = [
  "zoom",
  "teams",
  "webex",
  "meet",
  "discord",
  "slack",
  "tencentmeeting",
  "wemeet",
  "voov",
  "腾讯会议",
  "飞书",
  "lark",
  "dingtalk",
  "钉钉",
];

const MEDIA_HINTS = [
  "spotify",
  "vlc",
  "music",
  "itunes",
  "netflix",
  "youtube",
  "potplayer",
  "mpv",
  "foobar",
  "qqmusic",
  "netease",
  "云音乐",
];

function blobOf(process: string, title: string): string {
  return `${process} ${title}`.toLowerCase();
}

export function categorizeForeground(process: string, title: string): AppCategory {
  const blob = blobOf(process, title);
  if (!blob.trim()) return "unknown";
  if (MEETING_HINTS.some((hint) => blob.includes(hint))) return "meeting";
  if (IDE_HINTS.some((hint) => blob.includes(hint))) return "ide";
  if (BROWSER_HINTS.some((hint) => blob.includes(hint))) return "browser";
  if (MEDIA_HINTS.some((hint) => blob.includes(hint))) return "media";
  return "other";
}

export function classifyActivity(
  idleMs: number,
  source: InputSource,
  idleThresholdMs: number,
): ActivityKind {
  if (source === "unavailable") return "idle";
  if (idleMs >= idleThresholdMs) return "idle";
  if (source === "keyboard") return "typing";
  return "active";
}

export function snapshotFromRaw(
  raw: {
    idleMs: number;
    source: InputSource;
    available: boolean;
    foreground?: { title: string; process: string; category?: string };
  },
  idleThresholdMs: number,
): ActivitySnapshot {
  const source: InputSource = raw.available ? raw.source : "unavailable";
  const kind = classifyActivity(raw.idleMs, source, idleThresholdMs);
  const foreground = raw.foreground
    ? {
        title: raw.foreground.title,
        process: raw.foreground.process,
        category:
          (raw.foreground.category as AppCategory | undefined) ??
          categorizeForeground(raw.foreground.process, raw.foreground.title),
      }
    : undefined;
  return {
    idleMs: Math.max(0, raw.idleMs),
    kind,
    source,
    available: raw.available,
    foreground,
  };
}

let lastLocalAt = Date.now();
let lastLocalSource: InputSource = "unknown";

export function noteLocalInput(source: "keyboard" | "mouse"): void {
  lastLocalAt = Date.now();
  lastLocalSource = source;
}

export function browserActivitySnapshot(idleThresholdMs: number): ActivitySnapshot {
  const idleMs = Math.max(0, Date.now() - lastLocalAt);
  return snapshotFromRaw(
    { idleMs, source: lastLocalSource, available: true },
    idleThresholdMs,
  );
}

export function resetBrowserActivityForTests(now = Date.now()): void {
  lastLocalAt = now;
  lastLocalSource = "unknown";
}

export function installBrowserActivityListeners(): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onMouse = () => noteLocalInput("mouse");
  const onKey = () => noteLocalInput("keyboard");
  window.addEventListener("pointermove", onMouse);
  window.addEventListener("pointerdown", onMouse);
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("pointermove", onMouse);
    window.removeEventListener("pointerdown", onMouse);
    window.removeEventListener("keydown", onKey);
  };
}
