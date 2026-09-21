# Quick Start

**中文：** [[快速开始]] · 仓库文档：[docs/getting-started.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/getting-started.md)

Need **Node.js LTS** and **Rust 1.88+**. The repo pins `1.88.0` in `rust-toolchain.toml`. System deps: [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Desktop app

```bash
git clone https://github.com/XYAIStudio/xyai-xiaoyuan.git
cd xyai-xiaoyuan
npm install
npm run tauri dev
```

Or `make install` then `make dev`. First launch compiles Rust.

You should see: always-on-top Xiaoyuan, a tray menu, click to cycle poses, double-click to open chat, right-click for 16 expressions / pat / feed / goodnight.

| Shortcut            | Action                    |
| ------------------- | ------------------------- |
| `CmdOrCtrl+Shift+Y` | Show Xiaoyuan             |
| `CmdOrCtrl+Shift+H` | Open current backend home |
| `CmdOrCtrl+Shift+C` | Open chat                 |
| `CmdOrCtrl+Shift+T` | Toggle click-through      |
| `CmdOrCtrl+Shift+P` | Pomodoro start/stop       |
| `CmdOrCtrl+Shift+K` | Pat                       |

Edit shortcuts under **Settings → Shortcuts**.

## Browser preview (no always-on-top)

```bash
npm run dev
```

Then open:

- Pet: <http://localhost:1420/?window=pet>
- Chat: <http://localhost:1420/?window=chat>
- Settings: <http://localhost:1420/?window=settings>

Vite has no tray, keychain, or transparent window. Use `npm run tauri dev` for the real desktop companion.

## No real backend

```bash
npm run mock:backends
```

Point Settings at `18088` / `13000` / `11340`. Accounts: [[Backends]].

## Live FreeOS on this machine

Prefer FreeOS at `http://127.0.0.1:8088` (`:3000` closed is fine):

```bash
npm run doctor
npm run live:freeos
```

Four steps: doctor → Settings → Test connection → chat. Details: [docs/live-freeos.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/live-freeos.md). Desktop 联调 is **token-first**; agent replies may need a FreeOS agent model configured. See [[Backends]].

Quality gate: `make check`.
