# 架构

小元是 **Tauri 2 + React 19 + Vite** 的桌面伴侣：透明置顶桌宠、紧凑对话、系统托盘。聊天 UI 不绑定某一个后端，而是通过 `BackendProvider` 对接 XYAIStudio 组织下的独立产品。

应用标识：`com.xyai.xiaoyuan`。版本 `0.1.0`（见 `package.json` / `src-tauri/tauri.conf.json`）。

## 目录

| 路径                                  | 职责                                     |
| ------------------------------------- | ---------------------------------------- |
| `src/windows/`                        | 桌宠 / 对话 / 设置三个窗口               |
| `src/lib/providers/`                  | 后端插件：类型、注册表、各产品实现、HTTP |
| `src/lib/poseMachine.ts`              | 姿态状态机                               |
| `src/lib/mascots.ts`                  | 16 官方造型目录与预加载                  |
| `src/lib/updates.ts`                  | 检查 / 安装更新                          |
| `scripts/mock-backends.mjs`           | 本机模拟 FreeOS / openXYOS / Grok Bot    |
| `src-tauri/`                          | Rust：窗口、托盘、配置、钥匙串、快捷键   |
| `src-tauri/capabilities/default.json` | 窗口权限（含 `updater` / `http`）        |
| `assets/mascot/`                      | 官方画源文件                             |

三个窗口标签：`pet`、`chat`、`settings`。浏览器预览用 `?window=` 选择同一套 React 入口。

## BackendProvider 插件模型

接口定义在 [`src/lib/providers/types.ts`](../src/lib/providers/types.ts)：

- `id`、中文 `labelZh`、英文 `labelEn`
- `ready`：没有远程对话 API 时必须 `false`，并给中文 `notReadyReason`（以「未就绪」开头）
- `testConnection` / `listAgents` / `sendChat`（流式回调）
- 可选 `ensureThread` / `loadHistory`
- `secretKeys`：要进钥匙串的键名
- `defaultBaseUrl`

注册表 [`src/lib/providers/registry.ts`](../src/lib/providers/registry.ts) 的 `BACKEND_PROVIDERS` 决定设置页下拉框顺序。当前：

1. `freeos`
2. `openxyos`
3. `xyai-studio`（未就绪 stub）
4. `grokbot`

配置 [`src/lib/types.ts`](../src/lib/types.ts) 的 `AppConfig`：已有产品用专用字段（`freeos` / `openxyos` / `xyaiStudio` / `grokbot`）。新品可写入 `providerOptions[id]`。Rust 侧 `provider_id` 与 `provider_options` 是开放字符串 / JSON，不必改枚举。

共享 HTTP：15 秒超时、错误正文解析、可选重试（`src/lib/retry.ts`）。

## 如何新增一个 Backend Provider

目标：以后组织里多一个独立仓库，只加 provider，不必重写桌宠与对话 UI。

1. 阅读目标仓库的**公开**路由 / 客户端，**不要臆造端点**。若尚无远程对话 API，仍要注册，并设 `ready: false`。
2. 把 `id` 加入 `PROVIDER_IDS`（`src/lib/providers/types.ts`）。
3. 新建 `src/lib/providers/<id>.ts`，实现 `BackendProvider`。
4. 把实例推进 `BACKEND_PROVIDERS`。
5. 配置：专用 `AppConfig` 字段，或 `providerOptions[id]`。
6. 若有口令或令牌，把 key 加进 `src-tauri/src/secrets_cmd.rs` 的 `SECRET_KEYS`。
7. 在 `src/windows/SettingsWindow.tsx` 增加该后端的表单。
8. 补 `src/lib/providers/providers.test.ts`（至少连接失败 / 未就绪文案）。
9. 更新 [后端对接](backends.md) 与 README 表格。

桌宠、托盘、16 表情与对话窗默认不用改。

## Rust 侧

| 模块             | 作用                                              |
| ---------------- | ------------------------------------------------- |
| `config_cmd.rs`  | 读写 `AppConfig`（含 `lockPose`）                 |
| `secrets_cmd.rs` | 发布构建走系统钥匙串；debug 写 `dev-secrets.json` |
| `window_cmd.rs`  | 显示 / 拖动窗口                                   |
| `tray.rs`        | 托盘：打开对话、设置、检查更新                    |

前端通过 `src/lib/tauriApi.ts` 调用。非 Tauri 环境（浏览器预览）走内存实现。

## 姿态如何接到对话

`useChatController` 在发送、流式、完成、出错时更新生命周期；`poseHintFromUserText` 识别感谢 / 创作。`PetWindow` 订阅配置与生命周期，调用 `resolvePose`。详见 [姿态与动画](poses.md)。
