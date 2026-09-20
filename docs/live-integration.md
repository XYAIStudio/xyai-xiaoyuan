# 本机联调

把小元指到**真实**的 FreeOS / openXYOS / 本机 Grok Bot，或继续用模拟网关。密钥只进系统钥匙串（开发构建写本机 `dev-secrets.json`），不要提交。

## 一键探活

```bash
npm run doctor
# 或
make doctor
```

脚本 `scripts/doctor.mjs` 只访问本机 HTTP，打印中文状态与延迟。默认端口：

| 名称             | 默认地址                 | 探活路径            | 环境变量                    |
| ---------------- | ------------------------ | ------------------- | --------------------------- |
| FreeOS           | `http://127.0.0.1:8088`  | `/api/setup/status` | `XYAI_FREEOS_URL`           |
| openXYOS         | `http://127.0.0.1:3000`  | `/api/health`       | `XYAI_OPENXYOS_URL`         |
| 本机 Grok Bot    | `http://127.0.0.1:1340`  | `/health`           | `XYAI_GROKBOT_URL`          |
| XYAI Studio 探测 | `http://127.0.0.1:5173`  | `/`                 | `XYAI_STUDIO_URL`           |
| 模拟 FreeOS      | `http://127.0.0.1:18088` | `/api/setup/status` | （`npm run mock:backends`） |
| 模拟 openXYOS    | `http://127.0.0.1:13000` | `/api/health`       |                             |
| 模拟 Grok Bot    | `http://127.0.0.1:11340` | `/health`           |                             |

可复制 [`.env.example`](../.env.example) 为 `.env`（已 gitignore）覆盖地址。`.env` 不会自动灌进桌面设置，只给 `doctor` / 文档脚本用。

```bash
cp .env.example .env
# 按需改端口后：
npm run doctor
```

## 指向真实后端

打印设置项（含当前环境变量）：

```bash
npm run live
npm run live:freeos
npm run live:openxyos
npm run live:grokbot
```

然后：

1. 先启动对应产品，再 `npm run doctor` 看到「就绪」与毫秒数。
2. `npm run tauri dev`（或浏览器预览设置页）。
3. **设置 → 后端** 选提供者，填同一地址与账号。
4. 点 **测试连接**：成功/失败文案后会带 `（12ms）` 一类延迟。
5. 保存。密钥进钥匙串。

| 后端        | 设置里填什么                           |
| ----------- | -------------------------------------- |
| FreeOS      | 用户名 + 密码                          |
| openXYOS    | 邮箱 + 密码                            |
| Grok Bot    | Bearer 令牌，或从 `gateway.json` 导入  |
| XYAI Studio | 保持「未就绪」，探测成功也不会假装能聊 |

接口字段见 [backends.md](backends.md)。不要臆造尚未公开的路由。

## 没有真实后端

```bash
npm run mock:backends
```

把设置地址改成 `18088` / `13000` / `11340`。账号：

| 模拟服务 | 账号                               |
| -------- | ---------------------------------- |
| FreeOS   | `xiaoyuan` / `xiaoyuan`            |
| openXYOS | `xiaoyuan@xyai.local` / `xiaoyuan` |
| Grok Bot | 令牌 `mock-token`                  |

集成测试仍打模拟契约（`src/lib/providers/contract.test.ts` + `providers.test.ts`），不依赖本机真服务。

## 常见失败

| 测试连接 / doctor     | 含义                               |
| --------------------- | ---------------------------------- |
| 端口无人监听          | 后端没起，或端口被改，先对表改地址 |
| 连接超时              | 服务卡住或防火墙；拉长等待后再试   |
| 无法解析主机名        | URL 写错                           |
| 登录响应缺少 token    | 账号错，或后端改了字段             |
| Studio 探测到但未就绪 | 预期行为：公开仓库仍无桌宠对话 API |

更完整的错误文案在 `src/lib/providers/connection.ts`。
