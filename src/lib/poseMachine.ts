import type { PetLifecycle, PetPoseId } from "./mascots";
import type { ActivitySnapshot, AppCategory } from "./activity";
import { TYPING_BURST_MS } from "./activity";
import type { PomodoroPhase } from "./pomodoro";
import type { ScreenUnderstandingResult } from "./screenUnderstanding";
import { poseForScreenCategory } from "./screenUnderstanding";
import { dayPeriodFromHour } from "./timeOfDay";

/** Crossfade duration; keep short so the transparent pet never empties. */
export const POSE_CROSSFADE_MS = 380;
/** Calm idle cycle — not a fidget. */
export const IDLE_CYCLE_MS = 12_000;
/** Manual picker holds this pose until chat state changes or this elapses. */
export const MANUAL_HOLD_MS = 18_000;
/** Long streams shift from thinking poses into create poses. */
export const STREAM_TO_CREATE_MS = 2_800;

export const IDLE_FRIENDLY_POSES: readonly PetPoseId[] = ["wave", "hug"];
export const GREET_POSES: readonly PetPoseId[] = ["hug", "wave"];
export const THINKING_POSES: readonly PetPoseId[] = ["think", "idea"];
export const BUSY_POSES: readonly PetPoseId[] = ["run", "explore"];
export const SUCCESS_POSES: readonly PetPoseId[] = ["thumbs", "celebrate"];
export const CREATE_POSES: readonly PetPoseId[] = ["magic", "paint"];
export const AFFECTION_POSES: readonly PetPoseId[] = ["hearts"];
export const NIGHT_POSES: readonly PetPoseId[] = ["night"];
export const EVENING_POSES: readonly PetPoseId[] = ["hug", "garden"];
export const FOCUS_POSES: readonly PetPoseId[] = ["think", "hero"];
export const BREAK_POSES: readonly PetPoseId[] = ["garden", "music"];
export const LONG_BREAK_POSES: readonly PetPoseId[] = ["party", "celebrate"];

export type PoseResolveOptions = {
  tick?: number;
  hour?: number;
  idlePose?: PetPoseId;
  current?: PetPoseId;
  autoExpression?: boolean;
  lockPose?: boolean;
  timeOfDayPoses?: boolean;
  moodEnergy?: number;
};

export type IdleCycleGate = {
  lockPose: boolean;
  autoExpression: boolean;
  dragging: boolean;
  lifecycle: PetLifecycle;
  now: number;
  manualHoldUntil: number;
};

export type CompanionPoseInput = PoseResolveOptions & {
  lifecycle: PetLifecycle;
  activityAware?: boolean;
  activity?: ActivitySnapshot | null;
  idleThresholdMs?: number;
  longIdleThresholdMs?: number;
  foregroundHints?: boolean;
  moodEnabled?: boolean;
  pomodoroPhase?: PomodoroPhase;
  /** Opt-in title / local-screenshot pose hints. Default off. */
  screenUnderstanding?: boolean;
  screenHint?: ScreenUnderstandingResult | null;
};

const BUSY_LIVES: ReadonlySet<PetLifecycle> = new Set([
  "connecting",
  "thinking",
  "streaming",
  "tool",
  "create",
]);

const CHAT_PRIORITY_LIVES: ReadonlySet<PetLifecycle> = new Set([
  "connecting",
  "thinking",
  "streaming",
  "tool",
  "create",
  "success",
  "error",
  "affection",
  "welcome",
]);

export function isBusyLifecycle(life: PetLifecycle): boolean {
  return BUSY_LIVES.has(life);
}

export function chatPoseTakesPriority(life: PetLifecycle): boolean {
  return CHAT_PRIORITY_LIVES.has(life);
}

function isPoseId(value: string | undefined): value is PetPoseId {
  return (
    value === "wave" ||
    value === "thumbs" ||
    value === "hearts" ||
    value === "idea" ||
    value === "think" ||
    value === "run" ||
    value === "celebrate" ||
    value === "explore" ||
    value === "magic" ||
    value === "garden" ||
    value === "music" ||
    value === "paint" ||
    value === "party" ||
    value === "hug" ||
    value === "hero" ||
    value === "night"
  );
}

export function poseEnergyScore(id: PetPoseId): number {
  switch (id) {
    case "night":
      return 10;
    case "think":
      return 28;
    case "hug":
      return 34;
    case "garden":
      return 40;
    case "wave":
      return 46;
    case "idea":
      return 52;
    case "paint":
      return 56;
    case "explore":
      return 60;
    case "magic":
      return 66;
    case "hearts":
      return 70;
    case "thumbs":
      return 74;
    case "music":
      return 78;
    case "run":
      return 82;
    case "hero":
      return 86;
    case "celebrate":
      return 90;
    case "party":
      return 96;
  }
}

export function evolveLifecycle(life: PetLifecycle, elapsedMs: number): PetLifecycle {
  if (life === "streaming" && elapsedMs >= STREAM_TO_CREATE_MS) return "create";
  return life;
}

export function shouldPauseIdleCycle(gate: IdleCycleGate): boolean {
  if (gate.lockPose) return true;
  if (!gate.autoExpression) return true;
  if (gate.dragging) return true;
  if (isBusyLifecycle(gate.lifecycle)) return true;
  if (gate.lifecycle === "success" || gate.lifecycle === "error") return true;
  if (gate.now < gate.manualHoldUntil) return true;
  return gate.lifecycle !== "idle" && gate.lifecycle !== "welcome";
}

export function pickFromPool(
  pool: readonly PetPoseId[],
  tick: number,
  current?: PetPoseId,
): PetPoseId {
  if (pool.length === 0) return "wave";
  const index = ((tick % pool.length) + pool.length) % pool.length;
  const chosen = pool[index];
  if (current && chosen === current && pool.length > 1) {
    return pool[(index + 1) % pool.length];
  }
  return chosen;
}

export function pickWithMood(
  pool: readonly PetPoseId[],
  tick: number,
  current: PetPoseId | undefined,
  energy: number | undefined,
): PetPoseId {
  if (energy == null || pool.length < 2) return pickFromPool(pool, tick, current);
  const ranked = [...pool].sort(
    (a, b) =>
      Math.abs(poseEnergyScore(a) - energy) - Math.abs(poseEnergyScore(b) - energy),
  );
  const first = ranked[0];
  if (current && first === current && ranked[1]) return ranked[1];
  return first;
}

export function posesForLifecycle(
  life: PetLifecycle,
  options: { hour?: number; idlePose?: PetPoseId; timeOfDayPoses?: boolean } = {},
): readonly PetPoseId[] {
  switch (life) {
    case "away":
      return NIGHT_POSES;
    case "idle":
      if (options.timeOfDayPoses !== false && options.hour != null) {
        const period = dayPeriodFromHour(options.hour);
        if (period === "night") return NIGHT_POSES;
        if (period === "morning") return GREET_POSES;
        if (period === "evening") return EVENING_POSES;
      }
      if (options.idlePose && isPoseId(options.idlePose)) {
        if ((IDLE_FRIENDLY_POSES as readonly string[]).includes(options.idlePose)) {
          return uniquePoses([options.idlePose, ...IDLE_FRIENDLY_POSES]);
        }
        return [options.idlePose];
      }
      return IDLE_FRIENDLY_POSES;
    case "welcome":
      return GREET_POSES;
    case "connecting":
    case "thinking":
    case "error":
      return THINKING_POSES;
    case "streaming":
      return THINKING_POSES;
    case "tool":
      return BUSY_POSES;
    case "success":
      return SUCCESS_POSES;
    case "create":
      return CREATE_POSES;
    case "affection":
      return AFFECTION_POSES;
  }
}

export function resolvePose(
  life: PetLifecycle,
  options: PoseResolveOptions = {},
): PetPoseId {
  const current =
    options.current && isPoseId(options.current) ? options.current : undefined;
  const idle =
    options.idlePose && isPoseId(options.idlePose) ? options.idlePose : "wave";
  if (options.lockPose) return current ?? idle;
  if (options.autoExpression === false && life !== "away") return idle;
  const pool = posesForLifecycle(life, {
    hour: options.hour,
    idlePose: idle,
    timeOfDayPoses: options.timeOfDayPoses,
  });
  return pickWithMood(pool, options.tick ?? 0, current, options.moodEnergy);
}

function poseFromForeground(
  category: AppCategory,
  tick: number,
  current: PetPoseId | undefined,
  energy: number | undefined,
): PetPoseId | null {
  switch (category) {
    case "ide":
      return pickWithMood(["think", "paint"], tick, current, energy);
    case "browser":
      return pickWithMood(["explore", "idea"], tick, current, energy);
    case "meeting":
      return pickWithMood(["wave", "hero"], tick, current, energy);
    case "media":
      return pickWithMood(["music", "party"], tick, current, energy);
    default:
      return null;
  }
}

export function poseFromActivity(
  snap: ActivitySnapshot,
  options: {
    idleThresholdMs: number;
    longIdleThresholdMs: number;
    foregroundHints?: boolean;
    tick?: number;
    current?: PetPoseId;
    moodEnergy?: number;
  },
): PetPoseId | null {
  if (!snap.available) return null;
  const tick = options.tick ?? 0;
  const energy = options.moodEnergy;
  if (snap.idleMs >= options.longIdleThresholdMs) return "night";
  if (snap.kind === "idle") return null;
  if (
    snap.kind === "typing" ||
    (snap.source === "keyboard" && snap.idleMs < TYPING_BURST_MS)
  ) {
    return pickWithMood(["think", "paint"], tick, options.current, energy);
  }
  if (options.foregroundHints && snap.foreground) {
    const hinted = poseFromForeground(
      snap.foreground.category,
      tick,
      options.current,
      energy,
    );
    if (hinted) return hinted;
  }
  return pickWithMood(["run", "wave"], tick, options.current, energy);
}

function poseFromPomodoro(
  phase: PomodoroPhase | undefined,
  tick: number,
  current: PetPoseId | undefined,
  energy: number | undefined,
): PetPoseId | null {
  if (!phase || phase === "idle") return null;
  if (phase === "focus") return pickWithMood(FOCUS_POSES, tick, current, energy);
  if (phase === "longBreak")
    return pickWithMood(LONG_BREAK_POSES, tick, current, energy);
  return pickWithMood(BREAK_POSES, tick, current, energy);
}

/**
 * Full companion resolver. Chat streaming / tool-busy / lock still win over
 * activity, pomodoro, and clock-based idle.
 */
export function resolveCompanionPose(input: CompanionPoseInput): PetPoseId {
  const current = input.current && isPoseId(input.current) ? input.current : undefined;
  const idle = input.idlePose && isPoseId(input.idlePose) ? input.idlePose : "wave";
  if (input.lockPose) return current ?? idle;
  if (input.autoExpression === false && input.lifecycle !== "away") return idle;

  const energy = input.moodEnabled === false ? undefined : input.moodEnergy;
  const tick = input.tick ?? 0;

  if (chatPoseTakesPriority(input.lifecycle) || isBusyLifecycle(input.lifecycle)) {
    return resolvePose(input.lifecycle, {
      tick,
      hour: input.hour,
      idlePose: idle,
      current,
      autoExpression: input.autoExpression,
      lockPose: false,
      timeOfDayPoses: input.timeOfDayPoses,
      moodEnergy: energy,
    });
  }

  const pomodoroPose = poseFromPomodoro(input.pomodoroPhase, tick, current, energy);
  if (pomodoroPose) return pomodoroPose;

  if (input.screenUnderstanding && input.screenHint) {
    const pool = poseForScreenCategory(input.screenHint.category);
    if (pool) return pickWithMood(pool, tick, current, energy);
  }

  if (input.activityAware !== false && input.activity) {
    const activityPose = poseFromActivity(input.activity, {
      idleThresholdMs: input.idleThresholdMs ?? 50_000,
      longIdleThresholdMs: input.longIdleThresholdMs ?? 420_000,
      foregroundHints: input.foregroundHints,
      tick,
      current,
      moodEnergy: energy,
    });
    if (activityPose) return activityPose;
  }

  return resolvePose("idle", {
    tick,
    hour: input.hour,
    idlePose: idle,
    current,
    autoExpression: true,
    timeOfDayPoses: input.timeOfDayPoses,
    moodEnergy: energy,
  });
}

export function nextIdlePose(
  current: PetPoseId,
  options: {
    hour?: number;
    tick: number;
    preferred?: PetPoseId;
    timeOfDayPoses?: boolean;
    moodEnergy?: number;
  } = { tick: 0 },
): PetPoseId {
  if (options.timeOfDayPoses !== false && options.hour != null) {
    const period = dayPeriodFromHour(options.hour);
    if (period === "night") return "night";
    if (period === "evening") {
      return pickWithMood(EVENING_POSES, options.tick, current, options.moodEnergy);
    }
    if (period === "morning") {
      return pickWithMood(GREET_POSES, options.tick, current, options.moodEnergy);
    }
  }
  const preferred =
    options.preferred &&
    (IDLE_FRIENDLY_POSES as readonly string[]).includes(options.preferred)
      ? options.preferred
      : undefined;
  const pool = uniquePoses([...(preferred ? [preferred] : []), ...IDLE_FRIENDLY_POSES]);
  return pickWithMood(pool, options.tick, current, options.moodEnergy);
}

export function planCrossfade(
  current: PetPoseId,
  next: PetPoseId,
): { from: PetPoseId; to: PetPoseId } | null {
  if (current === next) return null;
  return { from: current, to: next };
}

export type PoseHint = "affection" | "create" | null;

/** Map a user turn onto affection / create poses when the wording is clear. */
export function poseHintFromUserText(text: string): PoseHint {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/(谢谢|感谢|比心|爱你|辛苦了|thanks|thank you|love you)/i.test(trimmed)) {
    return "affection";
  }
  if (
    /(画一|画张|画个|画画|作画|绘画|生成图|生成一|创作|创造|绘制|\bgenerate\b|\bdraw\b|\bpaint\b|\bcreate\b)/i.test(
      trimmed,
    )
  ) {
    return "create";
  }
  return null;
}

function uniquePoses(ids: PetPoseId[]): PetPoseId[] {
  const seen = new Set<PetPoseId>();
  const out: PetPoseId[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
