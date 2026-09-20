# XYAI精灵小元

XYAI 官方桌面伴侣。小元是 XYAI 自有形象：透明置顶桌宠、紧凑对话窗、系统托盘，通过可插拔的 `BackendProvider` 连接 **XYAI Studio 组织下的独立产品**，并额外支持本机 Grok Bot 网关。

[English](#english)

## 支持的后端

在设置中选择后端并填写对应配置。密钥写入系统钥匙串（开发构建写入本机 `dev-secrets.json`，切勿提交）。

| 后端 | 仓库 | 默认地址 | 状态 | 实际对接的公开接口 |
| --- | --- | --- | --- | --- |
| **FreeOS / XYAI** | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS) | `http://127.0.0.1:8088` | 可用 | `GET /api/setup/status` · `POST /api/auth/login` `{username,password}` → `{access_token}` · `GET /api/auth/me` · `GET /api/agents` · `POST /api/agents/{id}/threads` · `GET .../threads/{id}/history` · WebSocket `/api/agents/{id}/chat/ws?token=` |
| **openXYOS 组织 OS** | [XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS) | `http://127.0.0.1:3000` | 可用 | `GET /api/health` · `POST /api/auth/login` `{email,password}` → `{data.tokens.accessToken}` · `GET /api/auth/me` · `GET /api/chats` · `GET/POST /api/chats/:id/messages` · `POST /api/assistant/chat` `{message,history,session_id}` → `{reply}`（小雄） |
| **XYAI Studio 桌面工作台** | [XYAIStudio/xyai-studio](https://github.com/XYAIStudio/xyai-studio) | （无远程对话入口） | **未就绪** | 本地优先 Electron 工作台。公开仓库没有桌宠可调用的 listAgents / 对话 HTTP API。现有互通是 Studio → openXYOS：`POST /api/xyai/agents/import` 等，请求头 `X-XYAI-Interop: studio`。提供方已注册，设置里可见，连接测试会说明未就绪。 |
| **本机 Grok Bot** | 本机网关（额外提供者） | `http://127.0.0.1:1340` | 可用 | `GET /health`（无鉴权）· `POST /api/listAgents` · `POST /api/sendPrompt` `{agentId,prompt}`，Bearer 令牌。可从 `sand-data/gateway.json` 的 `{port,scheme,host,token}` 导入（`0.0.0.0` / `::` 会改写为 `127.0.0.1`）。**仅本机 / 隧道使用，路径可能随网关版本变化。** |

架构按「任意 XYAIStudio 自有后端」设计，不绑死单一产品。以后新增组织内的独立仓库，只需加一个 provider，不必重写桌宠与对话 UI。

## 如何新增一个后端 Provider

共享层：`src/lib/providers/types.ts` 的 `BackendProvider`（`id`、中文 `labelZh`、`testConnection`、`listAgents`、`sendChat` 流式回调、可选 `ensureThread` / `loadHistory`）。

1. 阅读目标仓库的公开路由 / 客户端，**不要臆造端点**。若尚无远程对话 API，仍要注册，并设 `ready: false` 与中文 `notReadyReason`（以「未就绪」开头）。
2. 新建 `src/lib/providers/<id>.ts`，实现该接口。
3. 把 `id` 加入 `PROVIDER_IDS`（`src/lib/providers/types.ts`），并把实例推进 `BACKEND_PROVIDERS`（`src/lib/providers/registry.ts`）。
4. 配置：已有产品用 `AppConfig` 里的专用字段（`freeos` / `openxyos` / `xyaiStudio` / `grokbot`）。新品可写入 `providerOptions[id]`，Rust 端 `provider_id` 与 `provider_options` 均为开放字符串 / JSON，不必改枚举。
5. 若有口令或令牌，把 key 加进 `src-tauri/src/secrets_cmd.rs` 的 `SECRET_KEYS`，并在设置页提供输入框。
6. 在 `src/windows/SettingsWindow.tsx` 增加该后端的表单。桌宠、托盘、16 表情与对话窗无需改动。

## 运行

需要 **Node.js LTS** 与 **Rust 1.88+**（[Tauri 前置依赖](https://tauri.app/start/prerequisites/)）。仓库含 `rust-toolchain.toml`。

```bash
git clone https://github.com/XYAIStudio/xyai-xiaoyuan.git
cd xyai-xiaoyuan
npm install
npm run tauri dev
```

浏览器预览（无透明置顶）：`npm run dev`，然后打开 `http://localhost:1420/?window=pet`、`?window=chat`、`?window=settings`。

质量检查：`make check`（前端 lint / `tsc` / Vitest，以及 `cargo test`）。提交前可 `make install-hooks`。

全局快捷键默认：`CmdOrCtrl+Shift+Y` 显示小元，`CmdOrCtrl+Shift+H` 打开当前后端主页。左键点击桌宠打开对话，右键打开菜单（含 16 表情）。

## 小元 16 表情

官方造型包已纳入仓库（`assets/mascot/poses/` 中文文件名，`public/mascots/` 供界面使用），设置与右键菜单均可点选。

| # | id | 文件 |
| --- | --- | --- |
| 01 | wave | 挥手问好 |
| 02 | thumbs | 点赞鼓励 |
| 03 | hearts | 比心 |
| 04 | idea | 灵感乍现 |
| 05 | think | 认真思考 |
| 06 | run | 快乐奔跑 |
| 07 | celebrate | 胜利跳跃 |
| 08 | explore | 太空探索 |
| 09 | magic | 魔法创造 |
| 10 | garden | 园艺伙伴 |
| 11 | music | 音乐律动 |
| 12 | paint | 小画家 |
| 13 | party | 庆祝生日 |
| 14 | hug | 拥抱欢迎 |
| 15 | hero | 超级英雄 |
| 16 | night | 晚安陪伴 |

对话生命周期会映射到表情（思考 → think，生成中 → run，成功 → thumbs，夜间待机 → night 等），可在设置中关闭自动表情。

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
