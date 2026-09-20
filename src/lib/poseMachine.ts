import type { PetLifecycle, PetPoseId } from "./mascots";

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

export type PoseResolveOptions = {
  tick?: number;
  hour?: number;
  idlePose?: PetPoseId;
  current?: PetPoseId;
  autoExpression?: boolean;
  lockPose?: boolean;
};

export type IdleCycleGate = {
  lockPose: boolean;
  autoExpression: boolean;
  dragging: boolean;
  lifecycle: PetLifecycle;
  now: number;
  manualHoldUntil: number;
};

const BUSY_LIVES: ReadonlySet<PetLifecycle> = new Set([
  "connecting",
  "thinking",
  "streaming",
  "tool",
  "create",
]);

export function isBusyLifecycle(life: PetLifecycle): boolean {
  return BUSY_LIVES.has(life);
}

function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 6;
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

export function posesForLifecycle(
  life: PetLifecycle,
  options: { hour?: number; idlePose?: PetPoseId } = {},
): readonly PetPoseId[] {
  switch (life) {
    case "away":
      return NIGHT_POSES;
    case "idle":
      if (options.hour != null && isNightHour(options.hour)) return NIGHT_POSES;
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
  const pool = posesForLifecycle(life, { hour: options.hour, idlePose: idle });
  return pickFromPool(pool, options.tick ?? 0, current);
}

export function nextIdlePose(
  current: PetPoseId,
  options: { hour?: number; tick: number; preferred?: PetPoseId } = { tick: 0 },
): PetPoseId {
  if (options.hour != null && isNightHour(options.hour)) return "night";
  const preferred =
    options.preferred &&
    (IDLE_FRIENDLY_POSES as readonly string[]).includes(options.preferred)
      ? options.preferred
      : undefined;
  const pool = uniquePoses([...(preferred ? [preferred] : []), ...IDLE_FRIENDLY_POSES]);
  return pickFromPool(pool, options.tick, current);
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
