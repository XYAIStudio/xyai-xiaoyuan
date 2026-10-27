# Windows 安装包

**English:** [[Packaging]] · 仓库文档：[docs/packaging-windows.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/packaging-windows.md)

**没有公开下载。** GitHub Releases 为空，`latest.json` 返回 404。CI 可以打出未发布的 Windows NSIS，未登录打不开 Artifact。

本仓库若打包 Windows，以 **NSIS**（`setup.exe`）为准。常规 CI 只打这一份。Linux 云主机不能签出 Windows 包。

应用内窗口标题仍是「XYAI精灵小元」。安装目录和安装包使用不含空格的 **XYAI-Xiaoyuan**，主程序是 `xyai-xiaoyuan.exe`（`src-tauri/tauri.windows.conf.json`）。带空格的旧文件名会让快捷方式打不开，卸载也结束不了仍在运行的小元。

签名、Authenticode 与 `latest.json`：[docs/signing.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/signing.md)。

## CI 怎么打 NSIS

工作流：[Windows installers](https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml)

- `windows-latest` + Node LTS + Rust `1.88.0` + `x86_64-pc-windows-msvc`
- 只执行 `npx tauri build --bundles nsis`
- 未配置 `TAURI_SIGNING_PRIVATE_KEY` 时仍产出未签名 NSIS
- Artifact 名：`xyai-xiaoyuan-windows-x64-nsis`

这不是下载入口。成功运行会上传 Artifact `xyai-xiaoyuan-windows-x64-nsis`（文件名形如 `XYAI-Xiaoyuan_0.1.0_x64-setup.exe`，主程序 `xyai-xiaoyuan.exe`），未登录打开会 404。试用请克隆后 `npm run tauri dev`。以后若发布未签名安装包，SmartScreen 会提示未知发布者。已经装过带空格旧版的，先装这一版安装包，它会先结束旧进程再覆盖。

## 为何 CI 不打 MSI

WiX `light.exe` 曾在中文产品名路径上失败。因此 **CI 只打 NSIS**。需要 MSI 时，在本机 Windows 上确认 ASCII 产品名后自行：

```bash
npx tauri build --bundles msi
```

不要把中文产品名重新写进 Windows 包文件名。

## 自动更新

更新通道尚未开通。**设置 → 关于 → 检查更新**（托盘也有）预定读取：

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

`updaterJsonPreferNsis: true`，Windows 指向 NSIS 而不是 MSI。私钥不能进 Git。没有密钥时检查更新会提示尚未配置，不影响聊天。
