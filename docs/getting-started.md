# 快速开始

需要 **Node.js LTS** 与 **Rust 1.88+**。仓库根目录的 [`rust-toolchain.toml`](../rust-toolchain.toml) 钉死 `1.88.0`，`rustup` 进目录后会自动选用。系统级依赖见 [Tauri 前置条件](https://tauri.app/start/prerequisites/)。

## 安装并启动桌面端

```bash
git clone https://github.com/XYAIStudio/xyai-xiaoyuan.git
cd xyai-xiaoyuan
npm install
npm run tauri dev
```

也可以 `make install` 再 `make dev`。首次会编译 Rust 侧，耗时比纯前端长。

启动后会出现：

- 透明置顶桌宠（小元）
- 系统托盘：打开小元 / 对话 / 设置 / 检查更新
- 单击桌宠轮换俏皮姿态，双击打开对话；右键菜单含 16 表情、拍一拍 / 喂食 / 晚安、锁定姿态

默认全局快捷键：

| 快捷键              | 作用             |
| ------------------- | ---------------- |
| `CmdOrCtrl+Shift+Y` | 显示小元         |
| `CmdOrCtrl+Shift+H` | 打开当前后端主页 |
| `CmdOrCtrl+Shift+C` | 打开对话         |
| `CmdOrCtrl+Shift+T` | 切换点击穿透     |
| `CmdOrCtrl+Shift+P` | 番茄钟开始/结束  |
| `CmdOrCtrl+Shift+K` | 拍一拍           |

可在 **设置 → 快捷键** 修改。

## 浏览器预览（无透明置顶）

不走 Tauri 时可用 Vite 预览三个窗口。没有置顶、托盘、钥匙串与自动更新。

```bash
npm run dev
```

然后打开：

| 窗口 | 地址                                     |
| ---- | ---------------------------------------- |
| 桌宠 | <http://localhost:1420/?window=pet>      |
| 对话 | <http://localhost:1420/?window=chat>     |
| 设置 | <http://localhost:1420/?window=settings> |

Vite 开发端口来自 `src-tauri/tauri.conf.json` 的 `build.devUrl`（`http://localhost:1420`）。

## 没有真实后端时

另开终端：

```bash
npm run mock:backends
```

等价于 `make mock`。模拟地址与账号见 [后端对接](backends.md#没有真实后端时模拟网关)。再在设置里改地址并点「测试连接」。

对接真实本机后端（优先 FreeOS `:8088`）：

```bash
npm run doctor
npm run live:freeos
```

`:3000` 未开可忽略。四步走：[FreeOS 联调](live-freeos.md)。多后端探活见 [本机联调](live-integration.md)。可复制 `.env.example` 覆盖默认端口。

## 质量检查

提交前建议：

```bash
make check
```

会跑前端 Prettier / ESLint / `tsc` / Vitest，以及 `cargo fmt --check`、`clippy`、`cargo check`、`cargo test`。一次性装 git hook：

```bash
make install-hooks
```

hook 实际执行 `make all`（含自动 format）。临时跳过：`SKIP_PRECOMMIT=1`。

## 下一步

- 对接真实产品：[后端对接](backends.md)
- 了解桌宠表情：[姿态与动画](poses.md)
- 打 Windows 安装包：[Windows 安装包](packaging-windows.md)
- 加一个新后端：[架构](architecture.md)
