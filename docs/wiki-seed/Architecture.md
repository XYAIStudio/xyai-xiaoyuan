# Architecture

**中文：** [[架构]] · 仓库文档：[docs/architecture.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/architecture.md)

**XYAI精灵小元 / XYAI Xiaoyuan** is **Tauri 2 + React 19 + Vite**. App id `com.xyai.xiaoyuan`, version `0.1.0`. Chat UI is not bound to one product: a `BackendProvider` talks to XYAIStudio backends (FreeOS, openXYOS, local Grok Bot / XYAI Studio).

## Layout

| Path                        | Role                                             |
| --------------------------- | ------------------------------------------------ |
| `src/windows/`              | Pet / chat / settings                            |
| `src/lib/providers/`        | Backend plugins, registry, HTTP                  |
| `src/lib/poseMachine.ts`    | Pose state machine                               |
| `src/lib/mascots.ts`        | 16 official poses                                |
| `scripts/mock-backends.mjs` | Local FreeOS / openXYOS / Grok Bot mocks         |
| `src-tauri/`                | Windows, tray, config, keychain, shortcuts, idle |

Window labels: `pet`, `chat`, `settings`. Browser preview uses `?window=` on the same React entry.

## BackendProvider

Defined in `src/lib/providers/types.ts`:

- `id`, `labelZh`, `labelEn`
- `ready` — must be `false` when there is no remote chat API, with a Chinese `notReadyReason` starting with「未就绪」
- `testConnection` / `listAgents` / `sendChat` (streaming)
- optional `ensureThread` / `loadHistory`
- `secretKeys`, `defaultBaseUrl`

Registry order (`BACKEND_PROVIDERS`): `freeos` → `openxyos` → `xyai-studio` (not-ready stub) → `grokbot`.

HTTP timeout is 15s. Do not invent unpublished routes.

## Add a provider

1. Read the target repo’s **public** routes. If there is no remote chat API, still register with `ready: false`.
2. Add `id` to `PROVIDER_IDS`.
3. Implement `src/lib/providers/<id>.ts` and push it into `BACKEND_PROVIDERS`.
4. Config: dedicated `AppConfig` field or `providerOptions[id]`.
5. Secrets: add the key in `src-tauri/src/secrets_cmd.rs`.
6. Settings form in `SettingsWindow.tsx`.
7. Tests in `providers.test.ts`.
8. Update [docs/backends.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/backends.md) and the README table.

Pet, tray, 16 poses, and the chat window should not need a rewrite. Details: [[Backends]].
