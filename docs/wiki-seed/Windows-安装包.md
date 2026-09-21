# Windows 安装包

**English:** [[Packaging]] · 仓库文档：[docs/packaging-windows.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/packaging-windows.md)

本仓库 Windows 安装包以 **NSIS**（`setup.exe`）为准。Linux 云主机不能签出 Windows 包，请走 GitHub Actions。

应用内窗口标题仍是「XYAI精灵小元」。安装包文件名使用 ASCII 产品名 **XYAI Xiaoyuan**（`src-tauri/tauri.windows.conf.json`），避免路径编码问题。

签名、Authenticode 与 `latest.json`：[docs/signing.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/signing.md)。

## CI 怎么打 NSIS

工作流：[Windows installers](https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml)

- `windows-latest` + Node LTS + Rust `1.88.0` + `x86_64-pc-windows-msvc`
- 只执行 `npx tauri build --bundles nsis`
- 未配置 `TAURI_SIGNING_PRIVATE_KEY` 时仍产出未签名 NSIS
- Artifact 名：`xyai-xiaoyuan-windows-x64-nsis`

下载：打开最新一次**成功**运行 → Artifacts → `xyai-xiaoyuan-windows-x64-nsis` → `XYAI Xiaoyuan_0.1.0_x64-setup.exe`。

## 为何 CI 不打 MSI

WiX `light.exe` 曾在中文产品名路径上失败。因此 **CI 只打 NSIS**。需要 MSI 时，在本机 Windows 上确认 ASCII 产品名后自行：

```bash
npx tauri build --bundles msi
```

不要把中文产品名重新写进 Windows 包文件名。

## 自动更新

**设置 → 关于 → 检查更新**（托盘也有）读取：

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

`updaterJsonPreferNsis: true`，Windows 指向 NSIS 而不是 MSI。私钥不能进 Git。没有密钥时检查更新会提示尚未配置，不影响聊天。
