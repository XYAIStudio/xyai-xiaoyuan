# 文档目录

XYAI精灵小元的完整说明都在本目录。界面文案与文档以中文为准。

仓库：[XYAIStudio/xyai-xiaoyuan](https://github.com/XYAIStudio/xyai-xiaoyuan)

## 文档

| 文档                                    | 内容                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| [快速开始](getting-started.md)          | 安装 Node LTS、Rust 1.88+，开发与浏览器预览                                |
| [后端对接](backends.md)                 | FreeOS / openXYOS / XYAI Studio（未就绪）/ 本机 Grok Bot，设置项与模拟网关 |
| [姿态与动画](poses.md)                  | 16 官方造型、状态映射、锁定与叠化                                          |
| [活动感知与声音](activity-and-sound.md) | 键盘鼠标空闲、隐私边界、音效开关                                           |
| [形象展示](gallery.md)                  | GIF + 16 静态造型                                                          |
| [Windows 安装包](packaging-windows.md)  | NSIS CI、Artifacts、更新签名密钥、为何不打 MSI                             |
| [架构](architecture.md)                 | `BackendProvider` 插件模型，如何接入新的 XYAIStudio 后端                   |
| [贡献指南](contributing.md)             | `make check`、PR 约定、禁止提及 OctopPet                                   |

仓库根目录还有 [README.md](../README.md) 与 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## Wiki 与讨论

- Wiki：<https://github.com/XYAIStudio/xyai-xiaoyuan/wiki>
- Discussions：<https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>

[`wiki-seed/`](wiki-seed/) 里是准备复制到 GitHub Wiki 的页面（Home、快速开始、后端对接、姿态与动画、常见问题、路线图）。内容与上述文档对应，Wiki 页使用 Wiki 链接写法，便于直接粘贴。

## 不要写进文档的内容

小元是 XYAI 自有形象。文档、代码注释、提交说明、Wiki 都不要出现 OctopPet 或其它第三方桌宠名称。
