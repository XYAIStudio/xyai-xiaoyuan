import {
  isNightHour,
  isPetPoseId,
  PET_POSE_IDS,
  PET_POSE_LIST,
  poseForLifecycle,
} from "./mascots";

describe("official 16 poses", () => {
  it("exposes sixteen unique pose ids matching the asset pack", () => {
    expect(PET_POSE_IDS).toHaveLength(16);
    expect(new Set(PET_POSE_IDS).size).toBe(16);
    expect(PET_POSE_LIST.map((pose) => pose.id)).toEqual([...PET_POSE_IDS]);
    expect(PET_POSE_LIST.map((pose) => pose.filenameZh)).toEqual([
      "01-挥手问好.png",
      "02-点赞鼓励.png",
      "03-比心.png",
      "04-灵感乍现.png",
      "05-认真思考.png",
      "06-快乐奔跑.png",
      "07-胜利跳跃.png",
      "08-太空探索.png",
      "09-魔法创造.png",
      "10-园艺伙伴.png",
      "11-音乐律动.png",
      "12-小画家.png",
      "13-庆祝生日.png",
      "14-拥抱欢迎.png",
      "15-超级英雄.png",
      "16-晚安陪伴.png",
    ]);
    expect(isPetPoseId("wave")).toBe(true);
    expect(isPetPoseId("octo")).toBe(false);
  });

  it("maps lifecycle states onto poses", () => {
    expect(poseForLifecycle("welcome")).toBe("hug");
    expect(poseForLifecycle("thinking")).toBe("think");
    expect(poseForLifecycle("streaming")).toBe("think");
    expect(poseForLifecycle("tool")).toBe("run");
    expect(poseForLifecycle("success")).toBe("thumbs");
    expect(poseForLifecycle("create")).toBe("magic");
    expect(poseForLifecycle("affection")).toBe("hearts");
    expect(poseForLifecycle("away")).toBe("night");
    expect(poseForLifecycle("idle", { hour: 23 })).toBe("night");
    expect(poseForLifecycle("idle", { hour: 10, idlePose: "hearts" })).toBe("hearts");
    expect(
      poseForLifecycle("thinking", { idlePose: "hero", autoExpression: false }),
    ).toBe("hero");
    expect(poseForLifecycle("thinking", { lockPose: true, current: "party" })).toBe(
      "party",
    );
    expect(isNightHour(2)).toBe(true);
    expect(isNightHour(12)).toBe(false);
  });
});
