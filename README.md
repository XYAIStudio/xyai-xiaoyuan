# XYAI精灵小元

XYAI 官方桌面伴侣。小元是 XYAI 自有形象：透明置顶桌宠、紧凑对话窗、系统托盘，通过可插拔的 `BackendProvider` 连接 **XYAI Studio 组织下的独立产品**，并额外支持本机 Grok Bot 网关。

[English](#english) · [文档目录](docs/README.md) · [Wiki](https://github.com/XYAIStudio/xyai-xiaoyuan/wiki) · [Discussions](https://github.com/XYAIStudio/xyai-xiaoyuan/discussions) · [贡献指南](CONTRIBUTING.md)

## 文档与社区

完整说明在 `docs/`（中文优先），不要只看本 README 的摘要。

| 文档                                         | 内容                                                  |
| -------------------------------------------- | ----------------------------------------------------- |
| [文档目录](docs/README.md)                   | 全部文档索引                                          |
| [快速开始](docs/getting-started.md)          | Node LTS、Rust 1.88+、`npm run tauri dev`、浏览器预览 |
| [后端对接](docs/backends.md)                 | 四个提供者、设置字段、`npm run mock:backends`         |
| [姿态与动画](docs/poses.md)                  | 16 官方造型、状态映射、锁定与叠化                     |
| [活动感知与声音](docs/activity-and-sound.md) | 键盘鼠标空闲、音效开关、隐私边界                      |
| [形象展示](docs/gallery.md)                  | GIF 与 16 静态造型                                    |
| [Windows 安装包](docs/packaging-windows.md)  | NSIS CI、Artifacts、更新签名密钥                      |
| [架构](docs/architecture.md)                 | `BackendProvider`，如何加新的 XYAIStudio 后端         |
| [贡献指南](docs/contributing.md)             | `make check`、PR 约定                                 |

Wiki 同步稿在 [`docs/wiki-seed/`](docs/wiki-seed/)，可复制到 GitHub Wiki：

- Wiki：<https://github.com/XYAIStudio/xyai-xiaoyuan/wiki>
- Discussions：<https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>

## 支持的后端

在设置中选择后端并填写对应配置。密钥写入系统钥匙串（开发构建写入本机 `dev-secrets.json`，切勿提交）。

| 后端                       | 仓库                                                                | 默认地址                | 状态       | 实际对接的公开接口                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------- | ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FreeOS / XYAI**          | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS)           | `http://127.0.0.1:8088` | 可用       | `GET /api/setup/status` · `POST /api/auth/login` `{username,password}` → `{access_token}` · `GET /api/auth/me` · `GET /api/agents` · `POST /api/agents/{id}/threads` · `GET .../threads/{id}/history` · WebSocket `/api/agents/{id}/chat/ws?token=`                  |
| **openXYOS 组织 OS**       | [XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS)       | `http://127.0.0.1:3000` | 可用       | `GET /api/health` · `POST /api/auth/login` `{email,password}` → `{data.tokens.accessToken}` · `GET /api/auth/me` · `GET /api/chats` · `GET/POST /api/chats/:id/messages` · `POST /api/assistant/chat` `{message,history,session_id}` → `{reply}`（小雄）             |
| **XYAI Studio 桌面工作台** | [XYAIStudio/xyai-studio](https://github.com/XYAIStudio/xyai-studio) | （无远程对话入口）      | **未就绪** | 本地优先 Electron 工作台。公开仓库没有桌宠可调用的 listAgents / 对话 HTTP API。现有互通是 Studio → openXYOS：`POST /api/xyai/agents/import` 等，请求头 `X-XYAI-Interop: studio`。提供方已注册，设置里可见，连接测试会说明未就绪。                                    |
| **本机 Grok Bot**          | 本机网关（额外提供者）                                              | `http://127.0.0.1:1340` | 可用       | `GET /health`（无鉴权）· `POST /api/listAgents` · `POST /api/sendPrompt` `{agentId,prompt}`，Bearer 令牌。可从 `sand-data/gateway.json` 的 `{port,scheme,host,token}` 导入（`0.0.0.0` / `::` 会改写为 `127.0.0.1`）。**仅本机 / 隧道使用，路径可能随网关版本变化。** |

架构按「任意 XYAIStudio 自有后端」设计，不绑死单一产品。以后新增组织内的独立仓库，只需加一个 provider，不必重写桌宠与对话 UI。完整字段与模拟网关见 [docs/backends.md](docs/backends.md)，插件步骤见 [docs/architecture.md](docs/architecture.md)。

## 如何新增一个后端 Provider

共享层：`src/lib/providers/types.ts` 的 `BackendProvider`（`id`、中文 `labelZh`、`testConnection`、`listAgents`、`sendChat` 流式回调、可选 `ensureThread` / `loadHistory`）。

1. 阅读目标仓库的公开路由 / 客户端，**不要臆造端点**。若尚无远程对话 API，仍要注册，并设 `ready: false` 与中文 `notReadyReason`（以「未就绪」开头）。
2. 新建 `src/lib/providers/<id>.ts`，实现该接口。
3. 把 `id` 加入 `PROVIDER_IDS`（`src/lib/providers/types.ts`），并把实例推进 `BACKEND_PROVIDERS`（`src/lib/providers/registry.ts`）。
4. 配置：已有产品用 `AppConfig` 里的专用字段（`freeos` / `openxyos` / `xyaiStudio` / `grokbot`）。新品可写入 `providerOptions[id]`，Rust 端 `provider_id` 与 `provider_options` 均为开放字符串 / JSON，不必改枚举。
5. 若有口令或令牌，把 key 加进 `src-tauri/src/secrets_cmd.rs` 的 `SECRET_KEYS`，并在设置页提供输入框。
6. 在 `src/windows/SettingsWindow.tsx` 增加该后端的表单。桌宠、托盘、16 表情与对话窗无需改动。逐步说明见 [docs/architecture.md](docs/architecture.md)。

## 运行

需要 **Node.js LTS** 与 **Rust 1.88+**（[Tauri 前置依赖](https://tauri.app/start/prerequisites/)）。仓库含 `rust-toolchain.toml`。

```bash
git clone https://github.com/XYAIStudio/xyai-xiaoyuan.git
cd xyai-xiaoyuan
npm install
npm run tauri dev
```

浏览器预览（无透明置顶）：`npm run dev`，然后打开 `http://localhost:1420/?window=pet`、`?window=chat`、`?window=settings`。更完整的环境说明见 [docs/getting-started.md](docs/getting-started.md)。

质量检查：`make check`（前端 lint / `tsc` / Vitest，以及 `cargo test`）。提交前可 `make install-hooks`。

## 功能一览

- 透明置顶桌宠 + 紧凑对话 + 系统托盘，对接 XYAIStudio 各独立后端
- 16 官方造型：对话生命周期、活动感知、本地时钟、番茄钟共同驱动；**锁定姿态**优先
- 单击轮换俏皮姿态，双击打开对话；悬停闪光、拖动轻晃；右键「拍一拍 / 喂食」
- 声音脚手架：总开关默认关，音效/音乐分开关 + 音量 + 安静时段
- 桌宠外观：大小、透明度、置顶、点击穿透、边缘吸附、按显示器记住位置、开机启动
- 番茄钟与轻量心情能量条；桌宠旁短气泡提示（重连 / 番茄钟 / 错误），不刷系统通知

全局快捷键默认：`CmdOrCtrl+Shift+Y` 显示小元，`CmdOrCtrl+Shift+H` 打开当前后端主页，`CmdOrCtrl+Shift+C` 打开对话，`CmdOrCtrl+Shift+T` 切换点击穿透，`CmdOrCtrl+Shift+P` 番茄钟。左键单击桌宠轮换姿态，双击打开对话，右键打开菜单（含 16 表情、「拍一拍」与「锁定姿态」）。托盘可打开小元 / 对话 / 番茄钟 / 设置 / 检查更新。

## 形象展示

![小元动态预览](assets/showcase/dynamic/preview.gif)

更多静态造型见 [形象展示](assets/showcase/README.md) 与 [docs/gallery.md](docs/gallery.md)。

## 对接本机后端

先启动对应产品，再在小元 **设置 → 后端** 填写地址并测试连接。密钥进系统钥匙串，不要写进 Git。

| 后端        | 本机默认                | 设置里填什么                          |
| ----------- | ----------------------- | ------------------------------------- |
| FreeOS      | `http://127.0.0.1:8088` | 用户名 + 密码                         |
| openXYOS    | `http://127.0.0.1:3000` | 邮箱 + 密码                           |
| Grok Bot    | `http://127.0.0.1:1340` | Bearer 令牌，或从 `gateway.json` 导入 |
| XYAI Studio | （无远程对话 API）      | 保持「未就绪」                        |

## 没有真实后端时：模拟网关

```bash
npm run mock:backends
```

会在本机拉起三个模拟服务，用来预览对话流式输出和桌宠姿态，不必等 FreeOS：

| 模拟服务 | 地址                     | 账号                               |
| -------- | ------------------------ | ---------------------------------- |
| FreeOS   | `http://127.0.0.1:18088` | `xiaoyuan` / `xiaoyuan`            |
| openXYOS | `http://127.0.0.1:13000` | `xiaoyuan@xyai.local` / `xiaoyuan` |
| Grok Bot | `http://127.0.0.1:11340` | 令牌 `mock-token`                  |

另开终端 `npm run tauri dev`，在设置里改地址后点「测试连接」。试着发「谢谢小元」「画一张星空」可分别看到比心 / 创作姿态。详见 [docs/backends.md](docs/backends.md)。

## Windows 安装包

本仓库 Windows 安装包以 **NSIS**（`setup.exe`）为准。Linux 云主机不能签出 Windows 安装包，请走 GitHub Actions：

- PR / `cursor/**` 分支：工作流 **Windows installers**（`.github/workflows/windows.yml`）在 `windows-latest` 只打 NSIS。产物 Artifacts 名 `xyai-xiaoyuan-windows-x64-nsis`。安装包文件名用 ASCII `XYAI Xiaoyuan`（`tauri.windows.conf.json`），应用内窗口标题仍是中文。
- 本机若已是 Windows：`npx tauri build --bundles nsis`
- 图标来自小元官方画（`src-tauri/icons/`，`assets/mascot/icon-source.png`）
- MSI / WiX 未进 CI：`light.exe` 会因中文产品名路径失败。需要 MSI 时请在本机 Windows 上用 ASCII productName 自行 `npx tauri build --bundles msi`

未配置更新签名密钥时，CI 仍会打出安装包，只是不含 updater 增量包。下载步骤、密钥清单与 MSI 说明见 [docs/packaging-windows.md](docs/packaging-windows.md)。

## 自动更新

桌面端 **设置 → 关于 → 检查更新**，托盘也有同名项。更新源为：

`https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json`

公开发布前请**自己生成**密钥（仓库里的 pubkey 仅作脚手架，私钥不会进 Git）：

```bash
npx tauri signer generate -w ~/.tauri/xyai-xiaoyuan.key
```

1. 把 `xyai-xiaoyuan.key.pub` 的内容贴进 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`（在首次给用户安装之前完成）。
2. GitHub → Settings → Secrets 添加 `TAURI_SIGNING_PRIVATE_KEY`（私钥文件全文），可选 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
3. 打 tag（`v0.1.1`）或手动跑 **Release** 工作流；`tauri-action` 会写 draft Release 并上传 `latest.json`。

没有密钥时检查更新会提示尚未配置，不影响日常聊天。清单见 [docs/packaging-windows.md](docs/packaging-windows.md#自动更新与签名密钥)。

## 小元 16 表情

官方造型包已纳入仓库（`assets/mascot/poses/` 中文文件名，`public/mascots/` 供界面使用），设置与右键菜单均可点选。

| #   | id        | 文件     |
| --- | --------- | -------- |
| 01  | wave      | 挥手问好 |
| 02  | thumbs    | 点赞鼓励 |
| 03  | hearts    | 比心     |
| 04  | idea      | 灵感乍现 |
| 05  | think     | 认真思考 |
| 06  | run       | 快乐奔跑 |
| 07  | celebrate | 胜利跳跃 |
| 08  | explore   | 太空探索 |
| 09  | magic     | 魔法创造 |
| 10  | garden    | 园艺伙伴 |
| 11  | music     | 音乐律动 |
| 12  | paint     | 小画家   |
| 13  | party     | 庆祝生日 |
| 14  | hug       | 拥抱欢迎 |
| 15  | hero      | 超级英雄 |
| 16  | night     | 晚安陪伴 |

对话生命周期会叠化切换到对应造型（约 380ms，避免透明窗黑闪），16 张 PNG 启动时预加载，不会每帧读盘：

| 状态            | 姿态                                   |
| --------------- | -------------------------------------- |
| 待机 / 问候     | 挥手问好、拥抱欢迎（约 12 秒温和轮换） |
| 思考 / 流式输出 | 认真思考、灵感乍现                     |
| 忙碌 / 工具调用 | 快乐奔跑、太空探索                     |
| 成功 / 完成     | 点赞鼓励、胜利跳跃                     |
| 感谢 / 亲近     | 比心                                   |
| 创作 / 生成     | 魔法创造、小画家                       |
| 夜间 / 离开     | 晚安陪伴                               |

流式输出或拖动桌宠时暂停待机轮换。右键菜单或设置里点选姿态会保持到下一次自动状态变化；勾选 **锁定姿态** 则完全冻结，直到取消锁定。设置中也可关闭自动表情。较长的流式回复会从思考姿态过渡到创作姿态。常量与状态机见 [docs/poses.md](docs/poses.md)。

## 许可证

[MIT](LICENSE) © 2026 XYAI

---

## English

**XYAI精灵小元** is XYAI’s official desktop companion. Xiaoyuan is XYAI’s own mascot. A Tauri 2 + React 19 app hosts a shared pet/chat UI on top of a pluggable `BackendProvider` so Xiaoyuan can talk to **any first-party XYAIStudio product**, plus an extra local Grok Bot gateway.

Built-in providers: **FreeOS** (self-hosted multi-agent host, default `127.0.0.1:8088`), **openXYOS** (organization OS chat/assistant, `127.0.0.1:3000`), **xyai-studio** (registered stub — no remote chat API yet), **本机 Grok Bot** (`127.0.0.1:1340`). Add another backend by implementing `BackendProvider` and registering it; see the Chinese section above.

```bash
npm install
npm run tauri dev
```

Browser preview (no always-on-top chrome): `npm run dev`, then `http://localhost:1420/?window=pet`. Poses crossfade (~380ms) instead of hard-cutting; all 16 PNGs are preloaded. Idle gently cycles wave/hug every ~12s and pauses while streaming or dragging. Single-click cycles a playful pose; double-click opens chat. A right-click or Settings pick holds until the next automatic state change; **锁定姿态** freezes the current pose. Activity sensing (keyboard/mouse idle) and optional sound switches live under Settings → 陪伴; master sound is off by default.

Docs (Chinese-first): [docs/README.md](docs/README.md). Wiki: <https://github.com/XYAIStudio/xyai-xiaoyuan/wiki>. Discussions: <https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>. Contributing: [CONTRIBUTING.md](CONTRIBUTING.md).

Without a live backend, `npm run mock:backends` serves FreeOS `:18088`, openXYOS `:13000`, and Grok Bot `:11340`. Windows NSIS installers are built on GitHub Actions (`windows-latest`); check the **Windows installers** workflow artifact `xyai-xiaoyuan-windows-x64-nsis`. Auto-update uses GitHub Releases `latest.json` — add `TAURI_SIGNING_PRIVATE_KEY` before the first public release (see [docs/packaging-windows.md](docs/packaging-windows.md)).
