# Packaging

**中文：** [[Windows 安装包]] · 仓库文档：[docs/packaging-windows.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/packaging-windows.md)

**No public download.** GitHub Releases are empty and `latest.json` returns 404. CI can produce an unpublished Windows NSIS build; anonymous artifact links 404.

When this repo packages Windows, the bundle is **NSIS** (`setup.exe`). The regular CI job builds that Windows package only. Linux CI hosts cannot produce Windows bundles.

In-app title stays **XYAI精灵小元**. The Windows install directory and setup filename use the space-free ASCII name **XYAI-Xiaoyuan**, and the executable is `xyai-xiaoyuan.exe` (`src-tauri/tauri.windows.conf.json`). A spaced name made the shortcut miss the exe and left uninstall unable to delete a still-running pet.

Signing, Authenticode, and `latest.json`: [docs/signing.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/signing.md).

## CI NSIS

Workflow: [Windows installers](https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml)

- `windows-latest` + Node LTS + Rust `1.88.0` + `x86_64-pc-windows-msvc`
- `npx tauri build --bundles nsis` only
- Missing `TAURI_SIGNING_PRIVATE_KEY` still builds an unsigned NSIS
- Artifact name: `xyai-xiaoyuan-windows-x64-nsis`

That artifact is not a public download. A successful run uploads `xyai-xiaoyuan-windows-x64-nsis` (filename like `XYAI-Xiaoyuan_0.1.0_x64-setup.exe`, exe `xyai-xiaoyuan.exe`); opening it while logged out returns 404. Run from source with `npm run tauri dev`. An unsigned installer published later will trip SmartScreen.

## Why CI does not ship MSI

WiX `light.exe` failed on Chinese `productName` paths. CI therefore ships **NSIS only**. Need MSI? On a Windows machine, after confirming the ASCII product name:

```bash
npx tauri build --bundles msi
```

Do not put the Chinese product name back into Windows package filenames.

## Auto-update

The update channel is not live. **Settings → About → Check for updates** (also in the tray) is wired to read:

```text
https://github.com/XYAIStudio/xyai-xiaoyuan/releases/latest/download/latest.json
```

`updaterJsonPreferNsis: true` points Windows at NSIS, not MSI. Private keys never go in Git. No key → the client says updates are not configured; chat still works.
