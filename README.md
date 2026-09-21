<div align="center">
  <img src="assets/mascot/icon-source.png" width="168" alt="XYAI精灵小元" />
  <h1>XYAI精灵小元</h1>
  <p>
    <strong>XYAI 官方桌面伴侣</strong><br />
    透明置顶桌宠 · 紧凑对话 · 系统托盘 · 可插拔后端
  </p>
  <p>
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/ci.yml"><img src="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml"><img src="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml/badge.svg" alt="Windows installers" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT" /></a>
    <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Rust-1.88-dea584?logo=rust&logoColor=white" alt="Rust 1.88" />
  </p>
  <p>
    <a href="README_EN.md">English</a> ·
    <a href="docs/README.md">文档目录</a> ·
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/wiki">Wiki</a> ·
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/discussions">Discussions</a> ·
    <a href="CONTRIBUTING.md">贡献指南</a>
  </p>
</div>

## 形象展示

小元是 **XYAI 自有形象**。官方造型包已纳入仓库，GitHub 可直接预览动态 GIF 与静态姿态。

<p align="center">
  <img src="assets/showcase/dynamic/preview.gif" width="280" alt="小元动态预览" />
</p>

<p align="center">
  <img src="assets/showcase/static/01-挥手问好.png" width="96" alt="挥手问好" />
  <img src="assets/showcase/static/03-比心.png" width="96" alt="比心" />
  <img src="assets/showcase/static/05-认真思考.png" width="96" alt="认真思考" />
  <img src="assets/showcase/static/07-胜利跳跃.png" width="96" alt="胜利跳跃" />
  <img src="assets/showcase/static/09-魔法创造.png" width="96" alt="魔法创造" />
  <img src="assets/showcase/static/14-拥抱欢迎.png" width="96" alt="拥抱欢迎" />
</p>

<p align="center">
  全部 16 个官方造型：
  <a href="assets/showcase/README.md">assets/showcase</a>
  ·
  <a href="docs/gallery.md">docs/gallery.md</a>
</p>

## 目录

- [形象展示](#形象展示)
- [亮点 Highlights](#亮点-highlights)
- [概览 Overview](#概览-overview)
- [快速开始 Quick Start](#快速开始-quick-start)
- [使用 Usage](#使用-usage)
- [开发 Development](#开发-development)
- [文档 Contents](#文档-contents)
- [许可证 License](#许可证-license)

## 亮点 Highlights

| 能力           | 说明                                                            |
| -------------- | --------------------------------------------------------------- |
| 透明置顶桌宠   | 无边框、始终置顶、可拖动；单击轮换姿态，双击打开对话            |
| 紧凑对话窗     | Markdown 渲染、流式输出、按当前后端列出智能体、番茄钟与快捷筹码 |
| 系统托盘       | 打开小元 / 对话 / 番茄钟 / 拍一拍 / 设置 / 检查更新             |
| 16 官方造型    | 对话生命周期、活动感知、本地时钟、番茄钟共同驱动；可锁定姿态    |
| 陪伴桌面       | 拍一拍 / 喂食 / 晚安、心情能量条、桌宠旁短气泡（不刷系统通知）  |
| 声音包         | 总开关默认关；仓库自制循环与拍一拍/喂食等音效                   |
| 屏幕理解       | 默认关；可选本机窗口标题 / 截屏启发式，**永不上传截图**         |
| 可插拔后端     | `BackendProvider` 对接 XYAIStudio 独立产品，并支持本机 Grok Bot |
| Windows 安装包 | GitHub Actions 打 NSIS `setup.exe`；签名密钥可选                |
| 自动更新       | 设置 / 托盘检查更新，源为 GitHub Releases `latest.json`         |

## 概览 Overview

**XYAI精灵小元** 是 XYAI 官方桌面伴侣：透明置顶桌宠、紧凑对话窗、系统托盘。聊天 UI 不绑死某一个产品，而是通过可插拔的 `BackendProvider` 连接 **XYAI Studio 组织下的独立产品**，并额外支持本机 Grok Bot 网关。

技术栈：**Tauri 2 + React 19 + Vite**，应用标识 `com.xyai.xiaoyuan`，当前版本 `0.1.0`。界面与文档以中文为准。

架构按「任意 XYAIStudio 自有后端」设计。以后组织内新增独立仓库，只需加一个 provider，不必重写桌宠与对话 UI。

### 支持的后端

在 **设置 → 后端** 选择并填写对应配置。密钥写入系统钥匙串（开发构建写入本机 `dev-secrets.json`，切勿提交）。

| 后端                       | 仓库                                                                | 默认地址                | 状态       | 实际对接的公开接口                                                                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------- | ----------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FreeOS / XYAI**          | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS)           | `http://127.0.0.1:8088` | 可用       | `GET /api/setup/status` · `POST /api/auth/login` `{username,password}` → `{access_token}` · `GET /api/auth/me` · `GET /api/agents` · `POST /api/agents/{id}/threads` · `GET .../threads/{id}/history` · WebSocket `/api/agents/{id}/chat/ws?token=`                  |
| **openXYOS 组织 OS**       | [XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS)       | `http://127.0.0.1:3000` | 可用       | `GET /api/health` · `POST /api/auth/login` `{email,password}` → `{data.tokens.accessToken}` · `GET /api/auth/me` · `GET /api/chats` · `GET/POST /api/chats/:id/messages` · `POST /api/assistant/chat` `{message,history,session_id}` → `{reply}`（小雄）             |
| **XYAI Studio 桌面工作台** | [XYAIStudio/xyai-studio](https://github.com/XYAIStudio/xyai-studio) | （无远程对话入口）      | **未就绪** | 本地优先 Electron 工作台。公开仓库没有桌宠可调用的 listAgents / 对话 HTTP API。现有互通是 Studio → openXYOS：`POST /api/xyai/agents/import` 等，请求头 `X-XYAI-Interop: studio`。提供方已注册，设置里可见，连接测试会说明未就绪。                                    |
| **本机 Grok Bot**          | 本机网关（额外提供者）                                              | `http://127.0.0.1:1340` | 可用       | `GET /health`（无鉴权）· `POST /api/listAgents` · `POST /api/sendPrompt` `{agentId,prompt}`，Bearer 令牌。可从 `sand-data/gateway.json` 的 `{port,scheme,host,token}` 导入（`0.0.0.0` / `::` 会改写为 `127.0.0.1`）。**仅本机 / 隧道使用，路径可能随网关版本变化。** |

完整字段、超时与模拟网关见 [docs/backends.md](docs/backends.md)；插件步骤见 [docs/architecture.md](docs/architecture.md)。

## 快速开始 Quick Start

需要 **Node.js LTS** 与 **Rust 1.88+**（[Tauri 前置依赖](https://tauri.app/start/prerequisites/)）。仓库含 `rust-toolchain.toml`。

```bash
git clone https://github.com/XYAIStudio/xyai-xiaoyuan.git
cd xyai-xiaoyuan
npm install
npm run tauri dev
```

也可以 `make install` 再 `make dev`。首次会编译 Rust 侧。启动后会出现透明置顶桌宠、系统托盘，以及对话 / 设置窗口。

**浏览器预览**（无透明置顶、托盘、钥匙串）：

```bash
npm run dev
```

然后打开 `http://localhost:1420/?window=pet`、`?window=chat`、`?window=settings`。

更完整的环境说明见 [docs/getting-started.md](docs/getting-started.md)。

## 使用 Usage

### 桌宠与快捷键

| 操作                | 作用                                           |
| ------------------- | ---------------------------------------------- |
| 单击桌宠            | 轮换俏皮姿态                                   |
| 双击桌宠            | 打开对话窗                                     |
| 右键点击桌宠        | 菜单：16 表情、拍一拍 / 喂食 / 晚安、锁定姿态  |
| 拖动桌宠            | 移动位置（靠近边缘可吸附；拖动时暂停待机轮换） |
| 托盘                | 打开小元 / 对话 / 番茄钟 / 拍一拍 / 设置       |
| `CmdOrCtrl+Shift+Y` | 显示小元                                       |
| `CmdOrCtrl+Shift+H` | 打开当前后端主页                               |
| `CmdOrCtrl+Shift+C` | 打开对话                                       |
| `CmdOrCtrl+Shift+T` | 切换点击穿透                                   |
| `CmdOrCtrl+Shift+P` | 番茄钟开始/结束                                |
| `CmdOrCtrl+Shift+K` | 拍一拍                                         |

快捷键可在 **设置 → 快捷键** 修改。活动感知、声音、番茄钟、安静时段与屏幕理解在 **设置 → 陪伴**（声音总开关与屏幕理解默认关）。

### 对接本机后端

先启动对应产品，再在小元 **设置 → 后端** 填写地址并测试连接。密钥进系统钥匙串，不要写进 Git。

| 后端               | 本机默认                | 设置里填什么                          |
| ------------------ | ----------------------- | ------------------------------------- |
| **FreeOS（优先）** | `http://127.0.0.1:8088` | 用户名 + 密码                         |
| openXYOS（可选）   | `http://127.0.0.1:3000` | 邮箱 + 密码；端口未开可忽略           |
| Grok Bot           | `http://127.0.0.1:1340` | Bearer 令牌，或从 `gateway.json` 导入 |
| XYAI Studio        | （无远程对话 API）      | 保持「未就绪」                        |

### 没有真实后端时：模拟网关

```bash
npm run mock:backends
```

会在本机拉起三个模拟服务，用来预览对话流式输出和桌宠姿态，不必等真实产品：

| 模拟服务 | 地址                     | 账号                               |
| -------- | ------------------------ | ---------------------------------- |
| FreeOS   | `http://127.0.0.1:18088` | `xiaoyuan` / `xiaoyuan`            |
| openXYOS | `http://127.0.0.1:13000` | `xiaoyuan@xyai.local` / `xiaoyuan` |
| Grok Bot | `http://127.0.0.1:11340` | 令牌 `mock-token`                  |

另开终端 `npm run tauri dev`，在设置里改地址后点「测试连接」（会显示延迟）。真实本机联调优先 FreeOS `http://127.0.0.1:8088`（`:3000` 未开可忽略）：`npm run doctor` / `npm run live:freeos`，见 [docs/live-integration.md](docs/live-integration.md)。试着发「谢谢小元」「画一张星空」可分别看到比心 / 创作姿态。XYAI Studio 没有模拟对话入口，因为它在产品侧仍是未就绪。详见 [docs/backends.md](docs/backends.md)。

### 小元 16 表情

官方造型源文件在 `assets/mascot/poses/`（中文文件名），界面使用 `public/mascots/`。仓库展示副本在 [`assets/showcase/`](assets/showcase/README.md)。设置与右键菜单均可点选。

对话生命周期会叠化切换到对应造型（约 380ms，避免透明窗黑闪），16 张 PNG 启动时预加载：

| 状态            | 姿态                                   |
| --------------- | -------------------------------------- |
| 待机 / 问候     | 挥手问好、拥抱欢迎（约 12 秒温和轮换） |
| 思考 / 流式输出 | 认真思考、灵感乍现                     |
| 忙碌 / 工具调用 | 快乐奔跑、太空探索                     |
| 成功 / 完成     | 点赞鼓励、胜利跳跃                     |
| 感谢 / 亲近     | 比心                                   |
| 创作 / 生成     | 魔法创造、小画家                       |
| 夜间 / 离开     | 晚安陪伴                               |

流式输出或拖动桌宠时暂停待机轮换。右键或设置点选姿态会保持到下一次自动状态变化；勾选 **锁定姿态** 则完全冻结，直到取消锁定。设置中也可关闭自动表情。活动感知、番茄钟与本地时钟叠在同一套状态机上，但不会压过对话流式或锁定。常量与状态机见 [docs/poses.md](docs/poses.md)，隐私边界见 [docs/activity-and-sound.md](docs/activity-and-sound.md)。

### Windows 安装包

本仓库 Windows 安装包以 **NSIS**（`setup.exe`）为准。Linux 云主机不能签出 Windows 安装包，请走 GitHub Actions：

- PR / `cursor/**` 分支 / `main`：工作流 **Windows installers**（`.github/workflows/windows.yml`）在 `windows-latest` 只打 NSIS。产物 Artifacts 名 `xyai-xiaoyuan-windows-x64-nsis`。安装包文件名用 ASCII `XYAI Xiaoyuan`（`tauri.windows.conf.json`），应用内窗口标题仍是中文。
- 本机若已是 Windows：`npx tauri build --bundles nsis`
- 图标来自小元官方画（`src-tauri/icons/`，`assets/mascot/icon-source.png`）
- MSI / WiX 未进 CI：需要 MSI 时请在本机 Windows 上用 ASCII productName 自行 `npx tauri build --bundles msi`

下载步骤见 [docs/packaging-windows.md](docs/packaging-windows.md)。生成密钥与 GitHub Secrets 见 [docs/signing.md](docs/signing.md)。没有签名密钥时 CI 仍打未签名 NSIS。

### 自动更新

桌面端 **设置 → 关于 → 检查更新**，托盘也有同名项。更新源：

`https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json`

公开发布前请**自己生成**密钥（仓库里的 pubkey 仅作脚手架，私钥不会进 Git）：

```bash
npx tauri signer generate -w ~/.tauri/xyai-xiaoyuan.key
```

1. 把 `xyai-xiaoyuan.key.pub` 的内容贴进 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`（在首次给用户安装之前完成）。
2. GitHub → Settings → Secrets 添加 `TAURI_SIGNING_PRIVATE_KEY`（私钥文件全文），可选 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
3. 打 tag（`v0.1.1`）或手动跑 **Release** 工作流；`tauri-action` 会写 draft Release 并上传 `latest.json`。

没有密钥时检查更新会提示尚未配置，不影响日常聊天。

## 开发 Development

质量检查（CI 同一目标）：

```bash
make check
```

会跑前端 Prettier / ESLint / `tsc` / Vitest，以及 `cargo fmt --check`、clippy、`cargo check`、`cargo test`。提交前可 `make install-hooks`。

### 如何新增一个后端 Provider

共享层：`src/lib/providers/types.ts` 的 `BackendProvider`（`id`、中文 `labelZh`、`testConnection`、`listAgents`、`sendChat` 流式回调、可选 `ensureThread` / `loadHistory`）。

1. 阅读目标仓库的公开路由 / 客户端，**不要臆造端点**。若尚无远程对话 API，仍要注册，并设 `ready: false` 与中文 `notReadyReason`（以「未就绪」开头）。
2. 新建 `src/lib/providers/<id>.ts`，实现该接口。
3. 把 `id` 加入 `PROVIDER_IDS`（`src/lib/providers/types.ts`），并把实例推进 `BACKEND_PROVIDERS`（`src/lib/providers/registry.ts`）。
4. 配置：已有产品用 `AppConfig` 里的专用字段（`freeos` / `openxyos` / `xyaiStudio` / `grokbot`）。新品可写入 `providerOptions[id]`，Rust 端 `provider_id` 与 `provider_options` 均为开放字符串 / JSON，不必改枚举。
5. 若有口令或令牌，把 key 加进 `src-tauri/src/secrets_cmd.rs` 的 `SECRET_KEYS`，并在设置页提供输入框。
6. 在 `src/windows/SettingsWindow.tsx` 增加该后端的表单。桌宠、托盘、16 表情与对话窗无需改动。

逐步说明见 [docs/architecture.md](docs/architecture.md)。贡献约定见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [docs/contributing.md](docs/contributing.md)。

## 文档 Contents

完整说明在 `docs/`（中文优先），不要只看本 README 的摘要。

| 文档                                         | 内容                                                  |
| -------------------------------------------- | ----------------------------------------------------- |
| [文档目录](docs/README.md)                   | 全部文档索引                                          |
| [快速开始](docs/getting-started.md)          | Node LTS、Rust 1.88+、`npm run tauri dev`、浏览器预览 |
| [后端对接](docs/backends.md)                 | 四个提供者、设置字段、`npm run mock:backends`         |
| [姿态与动画](docs/poses.md)                  | 16 官方造型、状态映射、锁定与叠化                     |
| [活动感知与声音](docs/activity-and-sound.md) | 键盘鼠标空闲、屏幕理解默认关、自制音效                |
| [本机联调](docs/live-integration.md)         | `npm run doctor`、真实后端与 `.env.example`           |
| [形象画廊](docs/gallery.md)                  | 动态 GIF + 16 静态造型预览                            |
| [Windows 安装包](docs/packaging-windows.md)  | NSIS CI、Artifacts、`latest.json`                     |
| [签名与更新](docs/signing.md)                | updater 私钥、可选 Authenticode                       |
| [架构](docs/architecture.md)                 | `BackendProvider`，如何加新的 XYAIStudio 后端         |
| [贡献指南](docs/contributing.md)             | `make check`、PR 约定                                 |
| [English](README_EN.md)                      | English landing page                                  |

Wiki 同步稿在 [`docs/wiki-seed/`](docs/wiki-seed/)，可复制到 GitHub Wiki：

- Wiki：<https://github.com/XYAIStudio/xyai-xiaoyuan/wiki>
- Discussions：<https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>

## 许可证 License

[MIT](LICENSE) © 2026 XYAI
