# Packaging

**中文：** [[Windows 安装包]] · 仓库文档：[docs/packaging-windows.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/packaging-windows.md)

Windows installers are **NSIS** (`setup.exe`). Linux CI hosts cannot produce Windows bundles — use GitHub Actions.

In-app title stays **XYAI精灵小元**. Package filenames use the ASCII product name **XYAI Xiaoyuan** (`src-tauri/tauri.windows.conf.json`) so WiX/NSIS paths stay reliable.

Signing, Authenticode, and `latest.json`: [docs/signing.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/signing.md).

## CI NSIS

Workflow: [Windows installers](https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml)

- `windows-latest` + Node LTS + Rust `1.88.0` + `x86_64-pc-windows-msvc`
- `npx tauri build --bundles nsis` only
- Missing `TAURI_SIGNING_PRIVATE_KEY` still builds an unsigned NSIS
- Artifact name: `xyai-xiaoyuan-windows-x64-nsis`

Download: open the latest **successful** run → Artifacts → `xyai-xiaoyuan-windows-x64-nsis` → `XYAI Xiaoyuan_0.1.0_x64-setup.exe`.

## Why CI does not ship MSI

WiX `light.exe` failed on Chinese `productName` paths. CI therefore ships **NSIS only**. Need MSI? On a Windows machine, after confirming the ASCII product name:

```bash
npx tauri build --bundles msi
```

Do not put the Chinese product name back into Windows package filenames.

## Auto-update

**Settings → About → Check for updates** (also in the tray) reads:

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

`updaterJsonPreferNsis: true` points Windows at NSIS, not MSI. Private keys never go in Git. No key → the client says updates are not configured; chat still works.
