# 后端对接

小元通过可插拔的 `BackendProvider` 连接 **XYAI Studio 组织下的独立产品**，并额外支持本机 Grok Bot 网关。桌宠、对话窗、16 表情不绑死某一个后端。

密钥写入系统钥匙串。开发构建写入本机 `dev-secrets.json`，切勿提交。

## 内置提供者

| 后端                       | 仓库                                                                | 默认地址                | 状态       | 设置里填什么                                    |
| -------------------------- | ------------------------------------------------------------------- | ----------------------- | ---------- | ----------------------------------------------- |
| **FreeOS / XYAI**          | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS)           | `http://127.0.0.1:8088` | 可用       | 地址、用户名、密码                              |
| **openXYOS 组织 OS**       | [XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS)       | `http://127.0.0.1:3000` | 可用       | API 地址、邮箱、密码                            |
| **XYAI Studio 桌面工作台** | [XYAIStudio/xyai-studio](https://github.com/XYAIStudio/xyai-studio) | （无远程对话入口）      | **未就绪** | 可选探测地址；连接测试会说明未就绪              |
| **本机 Grok Bot**          | 本机网关（额外提供者）                                              | `http://127.0.0.1:1340` | 可用       | 网关地址、Bearer 令牌，或从 `gateway.json` 导入 |

先启动对应产品，再打开小元 **设置 → 后端** 填写并点「测试连接」「保存」。测试连接会附带延迟毫秒数与中文错误。本机联调**优先 FreeOS `http://127.0.0.1:8088`**（Windows 上该端口常已开放；`:3000` 未开可忽略）。最短路径：[live-freeos.md](live-freeos.md)（doctor → 设置 → 测试 → 聊天）。探活见 [live-integration.md](live-integration.md)（`npm run doctor` / `npm run live:freeos`）。

HTTP 请求默认 15 秒超时（`src/lib/providers/http.ts`）。不要臆造端点：下列接口均来自各仓库当前公开路由。

## FreeOS

实际对接：

- `GET /api/health` `{status, version}`
- `GET /api/setup/status` `{setup_required, ...}`
- `POST /api/auth/login` `{username,password}` → `{access_token,user}`（用户名也可是邮箱）
- `GET /api/auth/me`
- `GET /api/agents`（`id` / `agent_id` / `name` / `state`）
- `POST /api/agents/{id}/threads` → `{thread_id, session_key}`（主路径，FreeOS 路由器）
- `GET .../threads/{id}/history`
- 若 `/threads` 返回 404，回退 `.../chat/sessions`（仅文档表别名）
- WebSocket `/api/agents/{id}/chat/ws?token=`

设置字段：`freeos.baseUrl`、`freeos.username`，密码钥匙串键 `freeos_password`。

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
