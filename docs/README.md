# 文档目录

XYAI精灵小元的完整说明都在本目录。界面文案与文档以中文为准。

仓库：[XYAIStudio/xyai-xiaoyuan](https://github.com/XYAIStudio/xyai-xiaoyuan)

## 文档

| 文档                                    | 内容                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- |
| [快速开始](getting-started.md)          | 安装 Node LTS、Rust 1.88+，开发与浏览器预览                                |
| [后端对接](backends.md)                 | FreeOS / openXYOS / XYAI Studio（未就绪）/ 本机 Grok Bot，设置项与模拟网关 |
| [姿态与动画](poses.md)                  | 16 官方造型、状态映射、锁定与叠化                                          |
| [活动感知与声音](activity-and-sound.md) | 键盘鼠标空闲、屏幕理解（默认关）、隐私边界、自制音效                       |
| [本机联调](live-integration.md)         | `npm run doctor`、真实 FreeOS / openXYOS / Grok Bot、`.env.example`        |
| [FreeOS 联调](live-freeos.md)           | doctor → 设置 → 测试连接 → 聊天（默认 :8088）                              |
| [形象画廊](gallery.md)                  | 动态 GIF 与 16 静态造型预览（`assets/showcase/`）                          |
| [Windows 安装包](packaging-windows.md)  | NSIS CI、Artifacts、`latest.json`、为何不打 MSI                            |
| [签名与更新](signing.md)                | `TAURI_SIGNING_PRIVATE_KEY`、可选 Authenticode、发布检查清单               |
| [架构](architecture.md)                 | `BackendProvider` 插件模型，如何接入新的 XYAIStudio 后端                   |
| [贡献指南](contributing.md)             | `make check`、PR 约定、文档与 Wiki 同步                                    |

仓库根目录还有 [README.md](../README.md)、[README_EN.md](../README_EN.md) 与 [CONTRIBUTING.md](../CONTRIBUTING.md)。形象展示副本在 [`assets/showcase/`](../assets/showcase/README.md)。

## Wiki 与讨论

- Wiki：<https://github.com/XYAIStudio/xyai-xiaoyuan/wiki>
- Discussions：<https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>

[`wiki-seed/`](wiki-seed/) 是 GitHub Wiki 的同步稿（文件名 = Wiki 标题）。首页为双语导航，指向：

| Wiki 中文                                                                         | Wiki English                                                                  |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [快速开始](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/快速开始)             | [Quick Start](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/Quick-Start)   |
| [后端对接](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/后端对接)             | [Backends](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/Backends)         |
| [姿态与动画](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/姿态与动画)         | [Poses](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/Poses)               |
| [Windows 安装包](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/Windows-安装包) | [Packaging](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/Packaging)       |
| [架构](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/架构)                     | [Architecture](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki/Architecture) |

另有侧栏 `_Sidebar.md`、页脚 `_Footer.md`、常见问题、活动感知与声音、路线图。内容对应上表文档；Wiki 页使用 `[[页面]]` 链接，便于直接粘贴或推到 `xyai-xiaoyuan.wiki.git`。

## 不要写进文档的内容

小元是 XYAI 自有形象。文档、代码注释、提交说明、Wiki 都不要写其它第三方桌宠名称。
