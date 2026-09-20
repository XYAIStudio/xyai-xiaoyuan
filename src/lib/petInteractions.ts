import type { PetPoseId } from "./mascots";
import { pickFromPool } from "./poseMachine";

export const PLAYFUL_POSES: readonly PetPoseId[] = [
  "party",
  "hearts",
  "celebrate",
  "music",
  "hero",
  "thumbs",
];

export const DOUBLE_CLICK_MS = 350;
export const DRAG_THRESHOLD_PX = 4;

export function nextPlayfulPose(current: PetPoseId, tick: number): PetPoseId {
  return pickFromPool(PLAYFUL_POSES, tick, current);
}

export function poseForPat(): PetPoseId {
  return "hearts";
}

export function poseForFeed(): PetPoseId {
  return "garden";
}

export function poseForHover(current: PetPoseId): PetPoseId {
  return current === "wave" ? "hug" : "wave";
}

export function poseForDrag(): PetPoseId {
  return "run";
}

export function isDragFromDelta(dx: number, dy: number): boolean {
  return dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;
}
