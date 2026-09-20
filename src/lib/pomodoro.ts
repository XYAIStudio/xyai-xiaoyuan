export type PomodoroPhase = "idle" | "focus" | "break" | "longBreak";

export interface PomodoroSettings {
  focusMin: number;
  breakMin: number;
  longBreakMin: number;
}

export interface PomodoroState {
  phase: PomodoroPhase;
  endsAt: number | null;
  focusCount: number;
}

export const DEFAULT_POMODORO: PomodoroSettings = {
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
};

export function clampMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(120, Math.max(1, Math.round(value)));
}

export function idlePomodoro(focusCount = 0): PomodoroState {
  return { phase: "idle", endsAt: null, focusCount };
}

export function phaseDurationMs(
  phase: PomodoroPhase,
  settings: PomodoroSettings,
): number {
  switch (phase) {
    case "focus":
      return clampMinutes(settings.focusMin, 25) * 60_000;
    case "break":
      return clampMinutes(settings.breakMin, 5) * 60_000;
    case "longBreak":
      return clampMinutes(settings.longBreakMin, 15) * 60_000;
    default:
      return 0;
  }
}

export function remainingMs(state: PomodoroState, now: number): number {
  if (state.phase === "idle" || state.endsAt == null) return 0;
  return Math.max(0, state.endsAt - now);
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function phaseLabelZh(phase: PomodoroPhase): string {
  switch (phase) {
    case "focus":
      return "专注中";
    case "break":
      return "短休息";
    case "longBreak":
      return "长休息";
    default:
      return "番茄钟";
  }
}

export function startFocus(
  now: number,
  settings: PomodoroSettings,
  focusCount = 0,
): PomodoroState {
  return {
    phase: "focus",
    endsAt: now + phaseDurationMs("focus", settings),
    focusCount,
  };
}

function nextAfterFocus(
  state: PomodoroState,
  now: number,
  settings: PomodoroSettings,
): PomodoroState {
  const count = state.focusCount + 1;
  const long = count > 0 && count % 4 === 0;
  const phase: PomodoroPhase = long ? "longBreak" : "break";
  return {
    phase,
    endsAt: now + phaseDurationMs(phase, settings),
    focusCount: count,
  };
}

export function tickPomodoro(
  state: PomodoroState,
  now: number,
  settings: PomodoroSettings,
): { state: PomodoroState; phaseChanged: boolean } {
  if (state.phase === "idle" || state.endsAt == null) {
    return { state, phaseChanged: false };
  }
  if (now < state.endsAt) return { state, phaseChanged: false };
  if (state.phase === "focus") {
    return { state: nextAfterFocus(state, now, settings), phaseChanged: true };
  }
  return { state: startFocus(now, settings, state.focusCount), phaseChanged: true };
}

export function skipPhase(
  state: PomodoroState,
  now: number,
  settings: PomodoroSettings,
): PomodoroState {
  if (state.phase === "idle") return startFocus(now, settings, state.focusCount);
  if (state.phase === "focus") return nextAfterFocus(state, now, settings);
  return startFocus(now, settings, state.focusCount);
}

export function togglePomodoro(
  state: PomodoroState,
  now: number,
  settings: PomodoroSettings,
): PomodoroState {
  if (state.phase === "idle") return startFocus(now, settings, state.focusCount);
  return idlePomodoro(state.focusCount);
}
