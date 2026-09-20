# 声音包（仓库自制）

`scripts/generate-audio.py` 合成的短循环与音效，许可见 [LICENSE](LICENSE)（对本仓库原始素材使用 CC0）。不要用受版权保护的音乐覆盖。

运行时副本：`public/audio/`（Vite 以 `/audio/...` 提供）。重新生成：

```bash
npm run audio:generate
```

## 音效 `sfx/`

| 文件                   | 用途                   |
| ---------------------- | ---------------------- |
| `pose-change.wav`      | 姿态切换（已节流）     |
| `message-received.wav` | 助手回复完成           |
| `idle.wav`             | 进入长空闲（预留）     |
| `pat.wav`              | 拍一拍                 |
| `feed.wav`             | 喂食                   |
| `pomodoro.wav`         | 番茄钟阶段切换         |
| `error.wav`            | 连接/回复出错          |
| `hover.wav`            | 悬停（预留，默认不播） |

## 音乐 `music/`

| 文件                 | 用途                                     |
| -------------------- | ---------------------------------------- |
| `companion-loop.wav` | 陪伴循环；需打开声音总开关 +「背景音乐」 |

播放逻辑见 `src/lib/audio.ts`：总开关关闭、音效/音乐分开关关闭、安静时段、或文件缺失时均为 no-op。默认总开关关、音乐关、音效开（仍受总开关约束）。
