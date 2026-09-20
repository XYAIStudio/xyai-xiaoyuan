# Windows 安装包

本仓库 Windows 安装包以 **NSIS**（`setup.exe`）为准。Linux 云主机不能签出 Windows 包，请走 GitHub Actions。

应用内窗口标题仍是「XYAI精灵小元」。安装包文件名使用 ASCII 产品名 **XYAI Xiaoyuan**（`src-tauri/tauri.windows.conf.json`），避免 WiX/NSIS 路径编码问题。

## CI 怎么打 NSIS

工作流：[`.github/workflows/windows.yml`](../.github/workflows/windows.yml)，名称 **Windows installers**。

触发：`pull_request`、`push` 到 `main` 或 `cursor/**`、手动 `workflow_dispatch`。

要点：

- `windows-latest` + Node LTS + Rust `1.88.0` + `x86_64-pc-windows-msvc`
- 只执行 `npx tauri build --bundles nsis`
- 未配置 `TAURI_SIGNING_PRIVATE_KEY` 时关闭 `createUpdaterArtifacts`，仍产出安装包
- 上传 Artifact 名：`xyai-xiaoyuan-windows-x64-nsis`
- `concurrency` 会取消同分支上过期的 Windows 任务

发布工作流 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 的 Windows 矩阵同样是 `--bundles nsis`。

本机已是 Windows 时：

```bash
npx tauri build --bundles nsis
```

图标来自小元官方画：`src-tauri/icons/`，源图 `assets/mascot/icon-source.png`。NSIS 语言：简体中文 + English。

## 如何下载 Actions 产物

1. 打开 <https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml>
2. 点进最新一次 **成功** 的 **Windows installers** 运行
3. 页面底部 **Artifacts** 下载 `xyai-xiaoyuan-windows-x64-nsis`
4. 解压后是 NSIS `setup.exe`（文件名形如 `XYAI Xiaoyuan_0.1.0_x64-setup.exe`）

GitHub Artifact 默认保留约 90 天，需要长期分发请走 GitHub Releases（见下方更新）。

也可在 PR 页面的 Checks 里点进同名工作流。

## 为何 CI 不打 MSI / WiX

早期 Windows 任务曾同时打 NSIS 与 MSI。Rust 编译与 NSIS 成功后，WiX `light.exe` 失败，目标路径类似：

```text
...\bundle\msi\XYAI精灵小元_0.1.0_x64_en-US.msi
```

中文 `productName` 进了 MSI 文件名，WiX 在该 runner 上无法可靠打包。因此：

- **CI 只打 NSIS**，不再调用 `light.exe`
- Windows 平台配置使用 ASCII `productName`：`XYAI Xiaoyuan`
- 需要 MSI 时，请在本机 Windows 上确认 ASCII 产品名后自行：

```bash
npx tauri build --bundles msi
```

不要把中文产品名重新写进 Windows 包文件名。

## 自动更新与签名密钥

桌面端 **设置 → 关于 → 检查更新**，托盘也有同名项。更新源：

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

公钥脚手架在 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。**私钥不能进 Git**。公开发布前请自己生成：

```bash
npx tauri signer generate -w ~/.tauri/xyai-xiaoyuan.key
```

清单：

1. 把 `xyai-xiaoyuan.key.pub` 贴进 `plugins.updater.pubkey`（在用户装上第一版之前完成）。
2. GitHub → Settings → Secrets and variables → Actions 添加：
   - **`TAURI_SIGNING_PRIVATE_KEY`**（私钥文件全文，必填才能打 updater 增量包）
   - **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**（若生成密钥时设了密码）
3. 打 tag（`v0.1.1` / `app-v0.1.1`）或手动跑 **Release** 工作流；`tauri-action` 会写 draft Release 并上传 `latest.json`。
4. 可选：Authenticode 代码签名（Windows 智能屏幕）。没有也能安装，只是会有来源提示。

没有密钥时检查更新会提示尚未配置，不影响日常聊天。CI 在缺密钥时仍上传 NSIS。
