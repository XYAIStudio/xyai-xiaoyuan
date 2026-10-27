# Windows 安装包

**现状：没有公开下载。** [GitHub Releases](https://github.com/XYAIStudio/xyai-xiaoyuan/releases) 还没有任何发布。自动更新清单 `https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json` 返回 404。下面写的是维护者如何打出**未发布**的 Windows NSIS，不是给访客的下载入口。

本仓库若打包 Windows，以 **NSIS**（`setup.exe`）为准。常规 CI 只打这一份 Windows 包。Linux 云主机不能签出 Windows 包。

应用内窗口标题仍是「XYAI精灵小元」。Windows 安装目录、开始菜单和安装包文件名使用**不含空格**的 ASCII 名 **XYAI-Xiaoyuan**，主程序是 `xyai-xiaoyuan.exe`（`src-tauri/tauri.windows.conf.json`）。以前的 `XYAI Xiaoyuan.exe` 带空格：快捷方式拆成错误路径，安装后打不开；桌宠又把关闭收成隐藏，卸载删不掉被占用的程序。安装和卸载前会 `taskkill` 结束当前进程和这个旧文件名。

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

## 没有公开下载

不要把 Actions Artifact 当成安装包下载页。

- Releases 目前为空，页面上没有 `setup.exe`。
- `latest.json` 返回 404，桌面端「检查更新」因此没有可用的更新源。
- 成功的 **Windows installers** 运行会上传 Artifact `xyai-xiaoyuan-windows-x64-nsis`（解压后文件名形如 `XYAI-Xiaoyuan_0.1.0_x64-setup.exe`，里面的主程序是 `xyai-xiaoyuan.exe`）。未登录打开 Artifact 链接会 404（接口返回 401）。这不是公开分发渠道，默认大约 90 天后过期。
- 这条 CI **只打 Windows NSIS**。Linux（AppImage / deb）和 macOS（app / dmg）只写在尚未发布过的 Release 工作流里，同样没有公开包。

想试用请克隆仓库后 `npm run tauri dev`。本机 Windows 的打包命令见上一节。

以后若把**未签名**的 NSIS 放到 Release 上，安装时 Windows SmartScreen 会提示未知发布者，直到配置 Authenticode（见 [signing.md](signing.md)）。

## 为何 CI 不打 MSI / WiX

早期 Windows 任务曾同时打 NSIS 与 MSI。Rust 编译与 NSIS 成功后，WiX `light.exe` 失败，目标路径类似：

```text
...\bundle\msi\XYAI精灵小元_0.1.0_x64_en-US.msi
```

中文 `productName` 进了 MSI 文件名，WiX 在该 runner 上无法可靠打包。因此：

- **CI 只打 NSIS**，不再调用 `light.exe`
- Windows 平台配置使用不含空格的 ASCII `productName`：`XYAI-Xiaoyuan`
- 需要 MSI 时，请在本机 Windows 上确认 ASCII 产品名后自行：

```bash
npx tauri build --bundles msi
```

不要把中文产品名重新写进 Windows 包文件名。

## 自动更新与 `latest.json`

更新通道**尚未开通**。下面的地址是将来发布后的约定，现在返回 404。

桌面端 **设置 → 关于 → 检查更新**，托盘也有同名项。预定更新源：

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

`latest.json` 由 `tauri-action` 写到 **同一 draft Release**，与 NSIS 安装包并列。因为 `updaterJsonPreferNsis: true`，Windows 平台 URL 指向 NSIS 产物，而不是 MSI。

公钥在 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。**私钥不能进 Git**。生成与 Secrets 清单见 [signing.md](signing.md)。

没有密钥时检查更新会提示尚未配置，不影响日常聊天。CI 在缺密钥时仍上传 NSIS。
