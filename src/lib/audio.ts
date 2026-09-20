export type SfxName =
  | "pose-change"
  | "message-received"
  | "idle"
  | "pat"
  | "feed"
  | "pomodoro"
  | "error"
  | "hover";

export const SFX_PATHS: Record<SfxName, string> = {
  "pose-change": "/audio/sfx/pose-change.wav",
  "message-received": "/audio/sfx/message-received.wav",
  idle: "/audio/sfx/idle.wav",
  pat: "/audio/sfx/pat.wav",
  feed: "/audio/sfx/feed.wav",
  pomodoro: "/audio/sfx/pomodoro.wav",
  error: "/audio/sfx/error.wav",
  hover: "/audio/sfx/hover.wav",
};

export const MUSIC_PATH = "/audio/music/companion-loop.wav";

export interface AudioSettings {
  soundEnabled: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export function parseHhMm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function minutesOfDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Inclusive start, exclusive end; wraps past midnight (e.g. 22:00–07:00). */
export function isQuietHours(
  nowMinutes: number,
  startSpec: string,
  endSpec: string,
): boolean {
  const start = parseHhMm(startSpec);
  const end = parseHhMm(endSpec);
  if (start == null || end == null) return false;
  if (start === end) return true;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 40;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function sfxAllowed(settings: AudioSettings, now: Date = new Date()): boolean {
  if (!settings.soundEnabled || !settings.sfxEnabled) return false;
  if (
    settings.quietHoursEnabled &&
    isQuietHours(minutesOfDate(now), settings.quietHoursStart, settings.quietHoursEnd)
  ) {
    return false;
  }
  return true;
}

export function musicAllowed(settings: AudioSettings, now: Date = new Date()): boolean {
  if (!settings.soundEnabled || !settings.musicEnabled) return false;
  if (
    settings.quietHoursEnabled &&
    isQuietHours(minutesOfDate(now), settings.quietHoursStart, settings.quietHoursEnd)
  ) {
    return false;
  }
  return true;
}

let musicEl: HTMLAudioElement | null = null;
const missingSrc = new Set<string>();

function volumeUnit(settings: AudioSettings): number {
  return clampVolume(settings.soundVolume) / 100;
}

function tryPlay(el: HTMLAudioElement, src: string): void {
  if (missingSrc.has(src)) return;
  el.addEventListener(
    "error",
    () => {
      missingSrc.add(src);
    },
    { once: true },
  );
  void el.play().catch(() => {
    /* autoplay / missing file — no-op */
  });
}

/** Play a named cue. No-ops when disabled, quiet, or the file is missing. */
export function playSfx(
  name: SfxName,
  settings: AudioSettings,
  now: Date = new Date(),
): void {
  if (!sfxAllowed(settings, now)) return;
  if (typeof Audio === "undefined") return;
  const src = SFX_PATHS[name];
  if (!src || missingSrc.has(src)) return;
  try {
    const audio = new Audio(src);
    audio.volume = volumeUnit(settings);
    tryPlay(audio, src);
  } catch {
    missingSrc.add(src);
  }
}

export function setMusic(
  on: boolean,
  settings: AudioSettings,
  now: Date = new Date(),
): void {
  if (typeof Audio === "undefined") return;
  const shouldPlay = on && musicAllowed(settings, now);
  if (!shouldPlay) {
    musicEl?.pause();
    return;
  }
  if (missingSrc.has(MUSIC_PATH)) return;
  try {
    if (!musicEl) {
      musicEl = new Audio(MUSIC_PATH);
      musicEl.loop = true;
    }
    musicEl.volume = volumeUnit(settings);
    tryPlay(musicEl, MUSIC_PATH);
  } catch {
    missingSrc.add(MUSIC_PATH);
  }
}

export function applyAudioSettings(
  settings: AudioSettings,
  now: Date = new Date(),
): void {
  setMusic(settings.musicEnabled, settings, now);
}

export function resetAudioForTests(): void {
  musicEl?.pause();
  musicEl = null;
  missingSrc.clear();
}
