<div align="center">
  <img src="assets/mascot/icon-source.png" width="168" alt="XYAI Xiaoyuan" />
  <h1>XYAI精灵小元</h1>
  <p>
    <strong>XYAI’s official desktop companion</strong><br />
    Always-on-top pet · compact chat · system tray · pluggable backends
  </p>
  <p>
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/ci.yml"><img src="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml"><img src="https://github.com/XYAIStudio/xyai-xiaoyuan/actions/workflows/windows.yml/badge.svg" alt="Windows installers" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT" /></a>
    <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Rust-1.88-dea584?logo=rust&logoColor=white" alt="Rust 1.88" />
  </p>
  <p>
    <a href="README.md">中文</a> ·
    <a href="docs/README.md">Docs (Chinese-first)</a> ·
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/wiki">Wiki</a> ·
    <a href="https://github.com/XYAIStudio/xyai-xiaoyuan/discussions">Discussions</a> ·
    <a href="CONTRIBUTING.md">Contributing</a>
  </p>
</div>

The product UI and `docs/` are Chinese-first. This page is a short English landing; details live in the Chinese docs.

## Showcase

Xiaoyuan is **XYAI’s own mascot**. Official poses ship in-repo.

<p align="center">
  <img src="assets/showcase/dynamic/preview.gif" width="280" alt="Xiaoyuan preview" />
</p>

<p align="center">
  <img src="assets/showcase/static/01-挥手问好.png" width="96" alt="Wave" />
  <img src="assets/showcase/static/03-比心.png" width="96" alt="Hearts" />
  <img src="assets/showcase/static/05-认真思考.png" width="96" alt="Think" />
  <img src="assets/showcase/static/07-胜利跳跃.png" width="96" alt="Celebrate" />
  <img src="assets/showcase/static/09-魔法创造.png" width="96" alt="Magic" />
  <img src="assets/showcase/static/14-拥抱欢迎.png" width="96" alt="Hug" />
</p>

<p align="center">
  All 16 official poses:
  <a href="assets/showcase/README.md">assets/showcase</a>
  ·
  <a href="docs/gallery.md">docs/gallery.md</a>
</p>

## Contents

- [Showcase](#showcase)
- [Highlights](#highlights)
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Development](#development)
- [Docs](#docs)
- [License](#license)

## Highlights

| Capability         | Notes                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| Always-on-top pet  | Frameless, draggable; left-click opens chat, right-click picks a pose        |
| Compact chat       | Markdown, streaming replies, agents from the selected backend                |
| System tray        | Open pet / chat / settings / check for updates                               |
| 16 official poses  | Lifecycle-driven crossfade (~380ms); optional pose lock                      |
| Pluggable backends | `BackendProvider` for first-party XYAIStudio products, plus a local Grok Bot |
| Windows installer  | GitHub Actions NSIS `setup.exe`                                              |
| Auto-update        | Settings / tray → GitHub Releases `latest.json`                              |

## Overview

**XYAI精灵小元** (Xiaoyuan) is XYAI’s official desktop companion. A Tauri 2 + React 19 app hosts a shared pet/chat UI on top of a pluggable `BackendProvider` so Xiaoyuan can talk to **any first-party XYAIStudio product**, plus an extra local Grok Bot gateway.

App id: `com.xyai.xiaoyuan`. Version: `0.1.0`.

### Built-in backends

Configure them in **Settings → Backend**. Secrets go to the OS keychain (dev builds write `dev-secrets.json` locally — never commit it).

| Backend                 | Repository                                                          | Default                 | Status        | Public APIs used                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------- | ----------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FreeOS / XYAI**       | [XYAIStudio/FreeOS](https://github.com/XYAIStudio/FreeOS)           | `http://127.0.0.1:8088` | Ready         | `GET /api/setup/status` · `POST /api/auth/login` · `GET /api/auth/me` · `GET /api/agents` · threads + history · WebSocket `/api/agents/{id}/chat/ws?token=`                                                                               |
| **openXYOS**            | [XYAIStudio/openXYOS](https://github.com/XYAIStudio/openXYOS)       | `http://127.0.0.1:3000` | Ready         | `GET /api/health` · email login · chats / messages · `POST /api/assistant/chat` (Xiaoxiong)                                                                                                                                               |
| **XYAI Studio desktop** | [XYAIStudio/xyai-studio](https://github.com/XYAIStudio/xyai-studio) | (no remote chat API)    | **Not ready** | Local-first Electron workbench. No listAgents / chat HTTP API for the pet. Existing interop is Studio → openXYOS (`POST /api/xyai/agents/import`, header `X-XYAI-Interop: studio`). Registered; connection test explains it is not ready. |
| **Local Grok Bot**      | Local gateway (extra provider)                                      | `http://127.0.0.1:1340` | Ready         | `GET /health` · `POST /api/listAgents` · `POST /api/sendPrompt`. Import `{port,scheme,host,token}` from `sand-data/gateway.json`. **Local / tunnel only; paths may change.**                                                              |

Full field list: [docs/backends.md](docs/backends.md) (Chinese). How to add a provider: [docs/architecture.md](docs/architecture.md).

## Quick Start

Requires **Node.js LTS** and **Rust 1.88+** ([Tauri prerequisites](https://tauri.app/start/prerequisites/)). This repo pins `rust-toolchain.toml`.

```bash
git clone https://github.com/XYAIStudio/xyai-xiaoyuan.git
cd xyai-xiaoyuan
npm install
npm run tauri dev
```

Browser preview (no always-on-top chrome): `npm run dev`, then `http://localhost:1420/?window=pet` (also `chat`, `settings`).

See [docs/getting-started.md](docs/getting-started.md).

## Usage

- Left-click the pet to chat; right-click for 16 poses and **锁定姿态** (lock pose).
- Tray: open pet / chat / settings / check for updates.
- Shortcuts: `CmdOrCtrl+Shift+Y` shows Xiaoyuan; `CmdOrCtrl+Shift+H` opens the current backend home page.

Connect a live product, then fill **Settings → Backend**. Without a live backend:

```bash
npm run mock:backends
```

| Mock     | URL                      | Credentials                        |
| -------- | ------------------------ | ---------------------------------- |
| FreeOS   | `http://127.0.0.1:18088` | `xiaoyuan` / `xiaoyuan`            |
| openXYOS | `http://127.0.0.1:13000` | `xiaoyuan@xyai.local` / `xiaoyuan` |
| Grok Bot | `http://127.0.0.1:11340` | token `mock-token`                 |

Poses crossfade (~380ms); all 16 PNGs are preloaded. Idle gently cycles wave/hug every ~12s and pauses while streaming or dragging. Windows NSIS installers are built on GitHub Actions (`windows-latest`); artifact `xyai-xiaoyuan-windows-x64-nsis`. Auto-update uses GitHub Releases `latest.json` — add `TAURI_SIGNING_PRIVATE_KEY` before the first public release ([docs/packaging-windows.md](docs/packaging-windows.md)).

## Development

```bash
make check
```

That is the CI target: Prettier / ESLint / `tsc` / Vitest, plus `cargo fmt --check`, clippy, `cargo check`, and `cargo test`. Optional: `make install-hooks`.

Add another backend by implementing `BackendProvider` and registering it; do not invent endpoints. If a product has no remote chat API yet, register it with `ready: false` and a Chinese `notReadyReason` starting with「未就绪」.

## Docs

Chinese-first index: [docs/README.md](docs/README.md)

| Doc                                            | Topic                          |
| ---------------------------------------------- | ------------------------------ |
| [Getting started](docs/getting-started.md)     | Install and run                |
| [Backends](docs/backends.md)                   | Four providers + mock gateways |
| [Poses](docs/poses.md)                         | 16 official poses              |
| [Gallery](docs/gallery.md)                     | GIF + stills                   |
| [Windows packaging](docs/packaging-windows.md) | NSIS CI and updater keys       |
| [Architecture](docs/architecture.md)           | `BackendProvider` plugin model |
| [Contributing](docs/contributing.md)           | `make check` and PR norms      |

- Wiki: <https://github.com/XYAIStudio/xyai-xiaoyuan/wiki>
- Discussions: <https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>

## License

[MIT](LICENSE) © 2026 XYAI
