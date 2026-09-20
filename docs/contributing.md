# 贡献指南

欢迎给 XYAI精灵小元提 PR。界面与文档以中文为准。完整索引见 [文档目录](README.md)。

## 环境

- Node.js LTS
- Rust 1.88+（仓库 `rust-toolchain.toml` 钉 `1.88.0`）
- [Tauri 前置依赖](https://tauri.app/start/prerequisites/)

```bash
npm install
make check
```

`make check` 是 CI（`.github/workflows/ci.yml`）使用的目标：前端 Prettier / ESLint / `tsc` / Vitest，Rust `fmt --check` / clippy / `cargo check` / `cargo test`。不要只跑其中一半。

开发：`npm run tauri dev`。没有后端时：`npm run mock:backends`。说明见 [快速开始](getting-started.md)。

```bash
make install-hooks
```

会把 git hook 指到 `.githooks/`，提交前跑 `make all`（含自动 format）。临时跳过：`SKIP_PRECOMMIT=1`。

## PR 约定

- 同一个功能尽量一个分支、一个 PR；描述写清行为变化，而不是只列文件名。
- 提交说明用现在时、说人话：做了什么、为什么。
- 改 UI / 姿态 / 后端对接时补测试（Vitest 或 `cargo test`）。
- 不要提交 `dev-secrets.json`、私钥、`gateway.json` 里的 token、`node_modules`、`dist`、`src-tauri/target`。
- 后端接口必须来自目标仓库的公开路由，禁止臆造。
- XYAI Studio 在远程对话 API 出现之前保持 **未就绪**，不要假装能聊。
- Windows 安装包以 NSIS 为准，不要在 CI 里重新打开 MSI/WiX，除非先解决 ASCII 文件名并在 `windows-latest` 上验证。见 [Windows 安装包](packaging-windows.md)。
- 文档改动放在 `docs/`，并在 [docs/README.md](README.md) / 根 README 留链接。Wiki 同步稿放 `docs/wiki-seed/`。

## 禁止 OctopPet

小元是 XYAI 自有形象。代码、注释、文档、Wiki、提交说明、Issue、Discussions **都不要出现 OctopPet** 或其它第三方桌宠名称。也不要复用那些项目的资源路径、包名或文案。

## 代码风格

- 前端：Prettier（`.prettierrc.json`）+ ESLint。
- Rust：`cargo fmt`、clippy `-D warnings`。
- 用户可见字符串用中文。
- 保持 `BackendProvider` 边界：新后端加 provider，不把产品逻辑写进 `PetWindow`。

## 社区

- Wiki：<https://github.com/XYAIStudio/xyai-xiaoyuan/wiki>
- Discussions：<https://github.com/XYAIStudio/xyai-xiaoyuan/discussions>
- Issues / PR：<https://github.com/XYAIStudio/xyai-xiaoyuan>
