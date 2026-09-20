export const MOOD_DEFAULT = 64;
export const MOOD_MIN = 0;
export const MOOD_MAX = 100;

export type MoodReason =
  "click" | "chat" | "pat" | "feed" | "hover" | "success" | "return";

const BUMPS: Record<MoodReason, number> = {
  click: 4,
  chat: 8,
  pat: 10,
  feed: 12,
  hover: 1,
  success: 6,
  return: 14,
};

export function clampMood(value: number): number {
  if (!Number.isFinite(value)) return MOOD_DEFAULT;
  return Math.min(MOOD_MAX, Math.max(MOOD_MIN, Math.round(value)));
}

/** Lose 1 energy per 30s of idle after a 20s grace period. */
export function decayMood(energy: number, idleMs: number): number {
  if (idleMs < 20_000) return clampMood(energy);
  const steps = Math.floor((idleMs - 20_000) / 30_000);
  return clampMood(energy - steps);
}

export function bumpMood(energy: number, reason: MoodReason): number {
  return clampMood(energy + BUMPS[reason]);
}

export function moodLabelZh(energy: number): string {
  const value = clampMood(energy);
  if (value >= 80) return "元气满满";
  if (value >= 55) return "心情不错";
  if (value >= 30) return "有点困";
  return "想休息";
}
