# Windows 安装包

本仓库 Windows 安装包以 **NSIS**（`setup.exe`）为准。Linux 云主机不能签出 Windows 包，请走 GitHub Actions。

应用内窗口标题仍是「XYAI精灵小元」。安装包文件名使用 ASCII 产品名 **XYAI Xiaoyuan**（`src-tauri/tauri.windows.conf.json`），避免 WiX/NSIS 路径编码问题。

签名密钥、Authenticode 与 `latest.json` 的逐步操作见 **[signing.md](signing.md)**。本地可用 `bash scripts/generate-tauri-signer.sh --print-only` 打印 GitHub Secret 步骤（不生成证书）。

## CI 怎么打 NSIS

工作流：[`.github/workflows/windows.yml`](../.github/workflows/windows.yml)，名称 **Windows installers**。

触发：`pull_request`、`push` 到 `main` 或 `cursor/**`、手动 `workflow_dispatch`。

要点：

- `windows-latest` + Node LTS + Rust `1.88.0` + `x86_64-pc-windows-msvc`
- 只执行 `npx tauri build --bundles nsis`
- 未配置 `TAURI_SIGNING_PRIVATE_KEY` 时，`scripts/tauri-ci-config.py` 关闭 `createUpdaterArtifacts`，仍产出安装包
- 可选 Authenticode：存在 `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD` 才导入证书；缺了就跳过，**不造假证书**
- 上传 Artifact 名：`xyai-xiaoyuan-windows-x64-nsis`
- `concurrency` 会取消同分支上过期的 Windows 任务

发布工作流 [`.github/workflows/release.yml`](../.github/workflows/release.yml) 的 Windows 矩阵同样是 `--bundles nsis`，并设置 `updaterJsonPreferNsis: true`。

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

GitHub Artifact 默认保留约 90 天，需要长期分发请走 GitHub Releases（见 [signing.md](signing.md)）。

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

## 自动更新与 `latest.json`

桌面端 **设置 → 关于 → 检查更新**，托盘也有同名项。更新源：

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

`latest.json` 由 `tauri-action` 写到 **同一 draft Release**，与 NSIS 安装包并列。因为 `updaterJsonPreferNsis: true`，Windows 平台 URL 指向 NSIS 产物，而不是 MSI。

公钥在 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。**私钥不能进 Git**。生成与 Secrets 清单见 [signing.md](signing.md)。

没有密钥时检查更新会提示尚未配置，不影响日常聊天。CI 在缺密钥时仍上传 NSIS。
