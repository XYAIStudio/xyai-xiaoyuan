# FreeOS 本机联调（:8088）

把小元接到本机 **FreeOS**。Windows 上常见情况是 **`127.0.0.1:8088` 已开放**，`:3000`（openXYOS）未开——**不要改端口**。

更完整的多后端探活见 [live-integration.md](live-integration.md)。接口字段见 [backends.md](backends.md)。

## 四步

```text
doctor 探活 → 设置填地址 → 测试连接 → 打开对话
```

### 1. 探活

本机先启动 [FreeOS](https://github.com/XYAIStudio/FreeOS)（默认 `OCTOP_PORT=8088`），再在小元仓库执行：

```bash
npm run doctor
# 或
make doctor
```

期望：

| doctor 文案 | 含义                                          |
| ----------- | --------------------------------------------- |
| 端口开放    | TCP 已通，先保持 FreeOS，不要改去 :3000       |
| HTTP 就绪   | `/api/setup/status` 或 `/api/health` 有应答   |
| 端口未开    | FreeOS 没起来；或改用 `npm run mock:backends` |

`:3000` 未开可忽略。

### 2. 设置

`npm run tauri dev`（或浏览器预览设置页）→ **设置 → 后端**：

- 后端选 **FreeOS / XYAI**
- 地址：`http://127.0.0.1:8088`
- 填 FreeOS 用户名和密码（钥匙串，勿提交）

`npm run live:freeos` 会打印同一组字段。

### 3. 测试连接

点 **测试连接**。成功时会看到绿色中文结果，带延迟，例如：

```text
已连接：admin · 角色 admin · 1 个智能体（32ms）。可打开对话窗开始聊天
```

失败时文案是中文，常见含义：

| 文案                    | 你要做什么                                  |
| ----------------------- | ------------------------------------------- |
| 端口无人监听 / 无法连接 | 先起 FreeOS，或 `npm run doctor`            |
| 尚未完成初始化          | 浏览器打开 `http://127.0.0.1:8088` 走完向导 |
| 用户名或密码错误        | 核对 FreeOS 账户（登录可用用户名或邮箱）    |
| 登录被锁定              | 试太多次；稍等或在 FreeOS 解锁              |
| 接口不存在              | 确认地址是 :8088，不要填 openXYOS :3000     |

### 4. 聊天

保存后打开对话窗，选智能体，发一条消息。对话走 WebSocket：

`ws://127.0.0.1:8088/api/agents/{id}/chat/ws?token=`

## 我们对齐的 FreeOS 路由

对照 FreeOS 仓库 **实际路由器**（`src/octop/api/routers/`），不是臆造：

| 用途     | 路径                                                            |
| -------- | --------------------------------------------------------------- |
| 探活     | `GET /api/health`、`GET /api/setup/status`                      |
| 登录     | `POST /api/auth/login` `{username,password}` → `{access_token}` |
| 当前用户 | `GET /api/auth/me`                                              |
| 智能体   | `GET /api/agents`                                               |
| 会话     | `POST /api/agents/{id}/threads`（主路径）                       |
| 历史     | `GET /api/agents/{id}/threads/{id}/history`                     |
| 对话     | WebSocket `/api/agents/{id}/chat/ws?token=`                     |

`docs/api.md` 里还有 `/chat/sessions` 表。小元只在主路径 **404** 时回退到该别名，避免文档/代码不一致时联调中断。

错误体按 FreeOS `OctopError` 信封解析：`{error:{code,message}}`，并译成中文。

## 没有真实 FreeOS

```bash
npm run mock:backends
```

把设置地址改成 `http://127.0.0.1:18088`，账号 `xiaoyuan` / `xiaoyuan`。模拟网关复用同一套 :8088 契约（`scripts/lib/freeos-mock.mjs`），集成测试也会打它。
