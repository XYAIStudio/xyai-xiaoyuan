export type ToastTone = "info" | "ok" | "warn";

export interface PetToast {
  id: string;
  text: string;
  tone: ToastTone;
}

export function makeToast(text: string, tone: ToastTone = "info"): PetToast {
  const trimmed = text.trim().slice(0, 80);
  return {
    id: `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    text: trimmed || "小元提醒",
    tone,
  };
}

export function toastDurationMs(text: string): number {
  return Math.min(5_600, 1_800 + text.length * 42);
}
