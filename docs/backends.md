# 后端对接

小元通过可插拔的 `BackendProvider` 连接 **XYAI Studio 组织下的独立产品**，并额外支持本机 Grok Bot 网关。桌宠、对话窗、16 表情不绑死某一个后端。

密钥写入系统钥匙串。开发构建写入本机 `dev-secrets.json`，切勿提交。

## 内置提供者

| 后端                       | 仓库                                                                | 默认地址                | 状态       | 设置里填什么                                         |
| -------------------------- | ------------------------------------------------------------------- | ----------------------- | ---------- | ---------------------------------------------------- |
| **FreeOS / XYAI**          | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS)           | `http://127.0.0.1:8088` | 可用       | 地址、用户名、密码（本机已登录可无密码，复用 token） |
| **openXYOS 组织 OS**       | [XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS)       | `http://127.0.0.1:3000` | 可用       | API 地址、邮箱、密码                                 |
| **XYAI Studio 桌面工作台** | [XYAIStudio/xyai-studio](https://github.com/XYAIStudio/xyai-studio) | （无远程对话入口）      | **未就绪** | 可选探测地址；连接测试会说明未就绪                   |
| **本机 Grok Bot**          | 本机网关（额外提供者）                                              | `http://127.0.0.1:1340` | 可用       | 网关地址、Bearer 令牌，或从 `gateway.json` 导入      |

先启动对应产品，再打开小元 **设置 → 后端** 填写并点「测试连接」「保存」。测试连接会附带延迟毫秒数与中文错误。本机联调**优先 FreeOS `http://127.0.0.1:8088`**（Windows 上该端口常已开放；`:3000` 未开可忽略）。最短路径：[live-freeos.md](live-freeos.md)（doctor → 设置 → 测试 → 聊天）。探活见 [live-integration.md](live-integration.md)（`npm run doctor` / `npm run live:freeos`）。

HTTP 请求默认 15 秒超时（`src/lib/providers/http.ts`）。不要臆造端点：下列接口均来自各仓库当前公开路由。

## 桌面 token-first 联调（FreeOS）

本机桌面联调是 **token-first**，不是无密码登录：

1. 先启动 FreeOS（默认 `http://127.0.0.1:8088`），必要时在 FreeOS 桌面完成登录。
2. 小元 **设置 → 后端** 保持 FreeOS / `:8088`。
3. 优先复用钥匙串 `freeos_token`（对应 FreeOS WebView 的 `auth_token`）。`GET /api/auth/me` 通过即可测连接、列智能体。没有有效令牌时再 `POST /api/auth/login` `{username,password}`（首次接入）。空密码登录会 `AUTH_FAILED`，不是可用路径。
4. 对话走已公开的 WebSocket：`/api/agents/{agent_id}/chat/ws?token=`。打开后先 `subscribe`，再 `user_turn`（带 `session_key`）。

**智能体模型配置：** 连接成功不等于模型能答。若聊天报模型 / 供应商错误，到 **FreeOS** 为该智能体配置模型。这是 FreeOS 侧配置，不是小元新增的接口。

## FreeOS

实际对接：

- `GET /api/health` `{status, version}`
- `GET /api/setup/status` `{setup_required, ...}`
- `POST /api/auth/login` `{username,password}` → `{access_token,user}`（用户名也可是邮箱）
- `GET /api/auth/me`
- `GET /api/agents`（同时有数字 `id` 与字符串 `agent_id`，例如 `main`）
- `POST /api/agents/{agent_id}/threads` → `{thread_id, session_key}`（主路径；路由必须用字符串 `agent_id`，不要用数字 `id`）
- `GET /api/agents/{agent_id}/threads` 返回数组
- `GET .../threads/{thread_id}/history`
- 若 `/threads` 返回 404，回退 `.../chat/sessions`（仅文档表别名）
- WebSocket `ws://host/api/agents/{agent_id}/chat/ws?token=`
  - 打开后先发 `{type:"subscribe", thread_id}`，再发 `{type:"user_turn", text, session_key, thread_id, messages:[{role:"user",content}]}`
  - 取消 `{type:"cancel", thread_id}`；保活 `{type:"ping"}`
  - 入站常见 `turn_status` / `error`；若有 `token`/`text` 增量与 `done` 也处理。`turn_status.active === false` 在无 `done` 时视为结束

**桌面 token-first 联调：** 空密码登录会 `AUTH_FAILED`。若本机 FreeOS 桌面已登录，小元优先复用钥匙串 `freeos_token`（对应 WebView Local Storage 的 `auth_token`），`GET /api/auth/me` 通过即可测连接、列智能体，不必再填密码。仅在没有有效 token 时才 `POST /api/auth/login`（首次接入）。

设置字段：`freeos.baseUrl`、`freeos.username`，钥匙串键 `freeos_password`、`freeos_token`。

**模型错误：** 「模型调用多次重试后仍失败…」来自 FreeOS 自己的模型/供应商配置，不是小元的连接或协议问题；对话里会原样标出。

## openXYOS

实际对接：

- `GET /api/health`
- `POST /api/auth/login` `{email,password}` → `{data.tokens.accessToken}`
- `GET /api/auth/me`
- `GET /api/chats`
- `GET/POST /api/chats/:id/messages`
- `POST /api/assistant/chat` `{message,history,session_id}` → `{reply}`（小雄）

设置字段：`openxyos.baseUrl`、`openxyos.email`，密码钥匙串键 `openxyos_password`。

## XYAI Studio（未就绪）

本地优先 Electron 工作台。公开仓库没有桌宠可调用的 `listAgents` / 对话 HTTP API。现有互通是 Studio → openXYOS：`POST /api/xyai/agents/import` 等，请求头 `X-XYAI-Interop: studio`。

提供方已注册，设置里可见并标「未就绪」。`testConnection` 即使探测到本机端口也会返回未就绪说明，不会假装能聊天。可选字段：`xyaiStudio.baseUrl`（默认占位 `http://127.0.0.1:5173`）。

## 本机 Grok Bot

实际对接：

- `GET /health`（无鉴权）
- `POST /api/listAgents`
- `POST /api/sendPrompt` `{agentId,prompt}`，Bearer 令牌

可从 `sand-data/gateway.json` 的 `{port,scheme,host,token}` 导入。`0.0.0.0` / `::` 会改写为 `127.0.0.1`。

**仅本机 / 隧道使用**，路径可能随网关版本变化。设置字段：`grokbot.baseUrl`、`grokbot.gatewayJsonPath`，令牌钥匙串键 `grokbot_token`。

## 没有真实后端时：模拟网关

```bash
npm run mock:backends
```

脚本是 `scripts/mock-backends.mjs`（`make mock` 同样调用）。会在本机拉起三个模拟服务，用来预览对话流式输出和桌宠姿态：

| 模拟服务 | 地址                     | 账号                               |
| -------- | ------------------------ | ---------------------------------- |
| FreeOS   | `http://127.0.0.1:18088` | `xiaoyuan` / `xiaoyuan`            |
| openXYOS | `http://127.0.0.1:13000` | `xiaoyuan@xyai.local` / `xiaoyuan` |
| Grok Bot | `http://127.0.0.1:11340` | 令牌 `mock-token`                  |

另开终端 `npm run tauri dev`（或浏览器预览设置页），把地址改成上表后点「测试连接」。试着发「谢谢小元」「画一张星空」可分别看到比心 / 创作姿态。

模拟回复不会调用真实模型；XYAI Studio 没有模拟对话入口，因为它在产品侧仍是未就绪。

## 新增后端

见 [架构：如何新增 Provider](architecture.md#如何新增一个-backend-provider)。
