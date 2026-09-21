# Poses

**中文：** [[姿态与动画]] · 仓库文档：[docs/poses.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/poses.md)

Xiaoyuan has **16 official poses**. Sources live in `assets/mascot/poses/`; the UI uses `public/mascots/`. Gallery: [docs/gallery.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/gallery.md).

| #   | id          | Name                 |
| --- | ----------- | -------------------- |
| 01  | `wave`      | 挥手问好 / Wave      |
| 02  | `thumbs`    | 点赞鼓励 / Thumbs up |
| 03  | `hearts`    | 比心 / Hearts        |
| 04  | `idea`      | 灵感乍现 / Idea      |
| 05  | `think`     | 认真思考 / Think     |
| 06  | `run`       | 快乐奔跑 / Run       |
| 07  | `celebrate` | 胜利跳跃 / Celebrate |
| 08  | `explore`   | 太空探索 / Explore   |
| 09  | `magic`     | 魔法创造 / Magic     |
| 10  | `garden`    | 园艺伙伴 / Garden    |
| 11  | `music`     | 音乐律动 / Music     |
| 12  | `paint`     | 小画家 / Paint       |
| 13  | `party`     | 庆祝生日 / Party     |
| 14  | `hug`       | 拥抱欢迎 / Hug       |
| 15  | `hero`      | 超级英雄 / Hero      |
| 16  | `night`     | 晚安陪伴 / Night     |

## Lifecycle → pose pool

| State              | Poses                                          |
| ------------------ | ---------------------------------------------- |
| Idle / welcome     | Wave, hug (~12s cycle); 22:00–06:00 uses night |
| Think / stream     | Think, idea (long streams move toward create)  |
| Busy / tool        | Run, explore                                   |
| Success            | Thumbs, celebrate                              |
| Thanks / affection | Hearts                                         |
| Create / generate  | Magic, paint                                   |
| Night / away       | Night                                          |

Crossfade ~380ms. All 16 PNGs preload. Streaming or dragging pauses the idle cycle. Right-click / Settings holds a pick; **Lock pose** freezes it. Try “谢谢小元” / “画一张星空” for hearts / create.

Activity, pomodoro, and the local clock share the same state machine and never override streaming or a locked pose. See [[活动感知与声音]] and [docs/poses.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/poses.md).
