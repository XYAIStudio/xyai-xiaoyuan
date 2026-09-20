import { resolvePose } from "./poseMachine";

export const PET_POSE_IDS = [
  "wave",
  "thumbs",
  "hearts",
  "idea",
  "think",
  "run",
  "celebrate",
  "explore",
  "magic",
  "garden",
  "music",
  "paint",
  "party",
  "hug",
  "hero",
  "night",
] as const;

export type PetPoseId = (typeof PET_POSE_IDS)[number];

export type PetLifecycle =
  | "idle"
  | "away"
  | "connecting"
  | "thinking"
  | "streaming"
  | "tool"
  | "create"
  | "affection"
  | "success"
  | "error"
  | "welcome";

export interface PetPose {
  id: PetPoseId;
  index: number;
  filenameZh: string;
  filenameEn: string;
  labelZh: string;
  role: string;
  src: string;
}

export const PET_POSES: Record<PetPoseId, PetPose> = {
  wave: {
    id: "wave",
    index: 1,
    filenameZh: "01-挥手问好.png",
    filenameEn: "wave.png",
    labelZh: "挥手问好",
    role: "idle / greet",
    src: "/mascots/wave.png",
  },
  thumbs: {
    id: "thumbs",
    index: 2,
    filenameZh: "02-点赞鼓励.png",
    filenameEn: "thumbs.png",
    labelZh: "点赞鼓励",
    role: "success / encourage",
    src: "/mascots/thumbs.png",
  },
  hearts: {
    id: "hearts",
    index: 3,
    filenameZh: "03-比心.png",
    filenameEn: "hearts.png",
    labelZh: "比心",
    role: "affection / happy",
    src: "/mascots/hearts.png",
  },
  idea: {
    id: "idea",
    index: 4,
    filenameZh: "04-灵感乍现.png",
    filenameEn: "idea.png",
    labelZh: "灵感乍现",
    role: "idea / suggestion",
    src: "/mascots/idea.png",
  },
  think: {
    id: "think",
    index: 5,
    filenameZh: "05-认真思考.png",
    filenameEn: "think.png",
    labelZh: "认真思考",
    role: "thinking / processing",
    src: "/mascots/think.png",
  },
  run: {
    id: "run",
    index: 6,
    filenameZh: "06-快乐奔跑.png",
    filenameEn: "run.png",
    labelZh: "快乐奔跑",
    role: "busy / working",
    src: "/mascots/run.png",
  },
  celebrate: {
    id: "celebrate",
    index: 7,
    filenameZh: "07-胜利跳跃.png",
    filenameEn: "celebrate.png",
    labelZh: "胜利跳跃",
    role: "task done / celebrate",
    src: "/mascots/celebrate.png",
  },
  explore: {
    id: "explore",
    index: 8,
    filenameZh: "08-太空探索.png",
    filenameEn: "explore.png",
    labelZh: "太空探索",
    role: "explore / research",
    src: "/mascots/explore.png",
  },
  magic: {
    id: "magic",
    index: 9,
    filenameZh: "09-魔法创造.png",
    filenameEn: "magic.png",
    labelZh: "魔法创造",
    role: "create / generate",
    src: "/mascots/magic.png",
  },
  garden: {
    id: "garden",
    index: 10,
    filenameZh: "10-园艺伙伴.png",
    filenameEn: "garden.png",
    labelZh: "园艺伙伴",
    role: "nurture / grow",
    src: "/mascots/garden.png",
  },
  music: {
    id: "music",
    index: 11,
    filenameZh: "11-音乐律动.png",
    filenameEn: "music.png",
    labelZh: "音乐律动",
    role: "fun / media",
    src: "/mascots/music.png",
  },
  paint: {
    id: "paint",
    index: 12,
    filenameZh: "12-小画家.png",
    filenameEn: "paint.png",
    labelZh: "小画家",
    role: "draw / design",
    src: "/mascots/paint.png",
  },
  party: {
    id: "party",
    index: 13,
    filenameZh: "13-庆祝生日.png",
    filenameEn: "party.png",
    labelZh: "庆祝生日",
    role: "special / party",
    src: "/mascots/party.png",
  },
  hug: {
    id: "hug",
    index: 14,
    filenameZh: "14-拥抱欢迎.png",
    filenameEn: "hug.png",
    labelZh: "拥抱欢迎",
    role: "welcome / hello",
    src: "/mascots/hug.png",
  },
  hero: {
    id: "hero",
    index: 15,
    filenameZh: "15-超级英雄.png",
    filenameEn: "hero.png",
    labelZh: "超级英雄",
    role: "power mode / boost",
    src: "/mascots/hero.png",
  },
  night: {
    id: "night",
    index: 16,
    filenameZh: "16-晚安陪伴.png",
    filenameEn: "night.png",
    labelZh: "晚安陪伴",
    role: "idle night / away",
    src: "/mascots/night.png",
  },
};

export const PET_POSE_LIST: PetPose[] = PET_POSE_IDS.map((id) => PET_POSES[id]);

export function isPetPoseId(value: string): value is PetPoseId {
  return (PET_POSE_IDS as readonly string[]).includes(value);
}

export function poseSrc(id: PetPoseId): string {
  return PET_POSES[id].src;
}

const preloadedPoseSrcs = new Set<string>();

/** Decode all 16 pose PNGs once so the pet never hits disk mid-fade. */
export function preloadPetPoses(): void {
  if (typeof Image === "undefined") return;
  for (const pose of PET_POSE_LIST) {
    if (preloadedPoseSrcs.has(pose.src)) continue;
    const image = new Image();
    image.decoding = "async";
    image.src = pose.src;
    preloadedPoseSrcs.add(pose.src);
  }
}

export function resetPosePreloadCache(): void {
  preloadedPoseSrcs.clear();
}

export function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 6;
}

export function poseForLifecycle(
  life: PetLifecycle,
  options: {
    idlePose?: PetPoseId;
    hour?: number;
    autoExpression?: boolean;
    lockPose?: boolean;
    tick?: number;
    current?: PetPoseId;
  } = {},
): PetPoseId {
  return resolvePose(life, options);
}
