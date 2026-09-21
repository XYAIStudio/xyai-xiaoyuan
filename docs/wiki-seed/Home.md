# XYAI精灵小元 / XYAI Xiaoyuan

XYAI 官方桌面伴侣。小元是 **XYAI 自有形象**：透明置顶桌宠、紧凑对话窗、系统托盘，通过可插拔后端连接 [XYAI Studio](https://github.com/XYAIStudio) 组织下的独立产品，并额外支持本机 Grok Bot 网关。

XYAI’s official desktop companion. Xiaoyuan is **XYAI’s own mascot**: always-on-top pet, compact chat, system tray, pluggable backends for XYAIStudio products, plus a local Grok Bot gateway.

源码 / Source: <https://github.com/XYAIStudio/xyai-xiaoyuan>

完整知识以仓库 [`docs/`](https://github.com/XYAIStudio/xyai-xiaoyuan/tree/main/docs) 为准。本 Wiki 由 [`docs/wiki-seed/`](https://github.com/XYAIStudio/xyai-xiaoyuan/tree/main/docs/wiki-seed) 同步，可直接粘贴。

Canonical docs stay in [`docs/`](https://github.com/XYAIStudio/xyai-xiaoyuan/tree/main/docs) on `main`. These pages are synced from [`docs/wiki-seed/`](https://github.com/XYAIStudio/xyai-xiaoyuan/tree/main/docs/wiki-seed).

## 导航 / Navigation

| 中文               | English          | 仓库文档 / In-repo                                                                                      |
| ------------------ | ---------------- | ------------------------------------------------------------------------------------------------------- |
| [[快速开始]]       | [[Quick Start]]  | [getting-started.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/getting-started.md)     |
| [[后端对接]]       | [[Backends]]     | [backends.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/backends.md)                   |
| [[姿态与动画]]     | [[Poses]]        | [poses.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/poses.md)                         |
| [[Windows 安装包]] | [[Packaging]]    | [packaging-windows.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/packaging-windows.md) |
| [[架构]]           | [[Architecture]] | [architecture.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/architecture.md)           |

### 其它 / More

- [[活动感知与声音]] — 空闲姿态、音效、屏幕理解默认关
- [[常见问题]] — 模拟网关、Studio 未就绪、NSIS、更新签名
- [[路线图]] — 后续方向

## 支持的后端 / Backends

在 **设置 → 后端** 选择。密钥进系统钥匙串（开发构建写入本机 `dev-secrets.json`，切勿提交）。

| 后端 / Backend                       | 默认地址 / Default      | 状态 / Status                 |
| ------------------------------------ | ----------------------- | ----------------------------- |
| **FreeOS / XYAI**                    | `http://127.0.0.1:8088` | 可用 / Ready                  |
| **openXYOS**                         | `http://127.0.0.1:3000` | 可用 / Ready                  |
| **XYAI Studio**                      | （无远程对话入口）      | **未就绪** / Not ready        |
| **本机 Grok Bot / XYAI Studio 网关** | `http://127.0.0.1:1340` | 可用 / Ready（仅本机 / 隧道） |

本机联调优先 FreeOS `:8088`。桌面联调是 **token-first**：复用已有会话令牌，`GET /api/auth/me` 校验；不要把空密码登录当成可用路径。智能体聊天若报模型错误，先到 FreeOS 配置该智能体的模型 / 供应商。详见 [[后端对接]] / [[Backends]]。

## 社区 / Community

- Discussions：<https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>
- 贡献 / Contributing：[CONTRIBUTING.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/CONTRIBUTING.md)

小元是 XYAI 自有形象。文档与讨论不要提及其它第三方桌宠。
