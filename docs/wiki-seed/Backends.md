# Backends

**中文：** [[后端对接]] · 仓库文档：[docs/backends.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/backends.md)

Pick a provider under **Settings → Backend**. Secrets go in the OS keychain (dev builds write local `dev-secrets.json` — never commit it).

| Backend               | Repo                                                     | Default                 | Status        | Settings                                                                             |
| --------------------- | -------------------------------------------------------- | ----------------------- | ------------- | ------------------------------------------------------------------------------------ |
| FreeOS / XYAI         | [FreeOS](https://github.com/XYAIStudio/FreeOS)           | `http://127.0.0.1:8088` | Ready         | URL, username, password; reuse a session token when the desktop is already signed in |
| openXYOS              | [openXYOS](https://github.com/XYAIStudio/openXYOS)       | `http://127.0.0.1:3000` | Ready         | API URL, email, password                                                             |
| XYAI Studio workbench | [xyai-studio](https://github.com/XYAIStudio/xyai-studio) | (no remote chat)        | **Not ready** | Optional probe URL                                                                   |
| Local Grok Bot        | local gateway                                            | `http://127.0.0.1:1340` | Ready         | URL, Bearer token or `gateway.json`                                                  |

Start the product first, then **Test connection** and **Save**. Prefer live FreeOS on `:8088`. Shortest path: [docs/live-freeos.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/live-freeos.md). Multi-backend probe: [docs/live-integration.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/live-integration.md).

Do **not** invent endpoints. The routes below are the current public ones.

## Token-first desktop 联调 (FreeOS)

Desktop integration is **token-first**, not passwordless login:

1. Start FreeOS at `http://127.0.0.1:8088` and finish sign-in in the FreeOS desktop if needed.
2. In Xiaoyuan **Settings → Backend**, keep FreeOS / `:8088`.
3. Reuse keychain `freeos_token` (FreeOS WebView `auth_token`). `GET /api/auth/me` is enough to test the connection and list agents. Call `POST /api/auth/login` `{username,password}` only when there is no valid token (first connect). Empty-password login is `AUTH_FAILED`, not a supported path.
4. Chat uses the published WebSocket: `/api/agents/{agent_id}/chat/ws?token=`. After open, send `subscribe` then `user_turn` (with `session_key`).

**Agent model config:** a successful connection does not guarantee a model reply. If chat fails with a model / provider error (for example retries exhausted), configure that agent’s model in **FreeOS**. That is FreeOS-side setup, not a Xiaoyuan-invented API.

## Published interfaces (do not invent)

**FreeOS:** token-first (reuse `auth_token` when already signed in) · routes use string `agent_id` · `GET /api/health` · `GET /api/setup/status` · `POST /api/auth/login` `{username,password}` → `{access_token}` · `GET /api/auth/me` · `GET /api/agents` · `POST /api/agents/{agent_id}/threads` → `{thread_id,session_key}` · history · WebSocket `subscribe` then `user_turn`

If `/threads` returns 404, Xiaoyuan falls back to the documented `/chat/sessions` alias.

**openXYOS:** `GET /api/health` · `POST /api/auth/login` (email) · chats / messages · `POST /api/assistant/chat`

**XYAI Studio:** local-first Electron workbench. The public repo has no listAgents / chat HTTP for the companion. Existing interop is Studio → openXYOS. The provider is registered and stays **not ready**.

**Grok Bot:** `GET /health` · `POST /api/listAgents` · `POST /api/sendPrompt`. Local / tunnel only.

## Mock gateways

```bash
npm run mock:backends
```

| Mock     | URL                      | Account                            |
| -------- | ------------------------ | ---------------------------------- |
| FreeOS   | `http://127.0.0.1:18088` | `xiaoyuan` / `xiaoyuan`            |
| openXYOS | `http://127.0.0.1:13000` | `xiaoyuan@xyai.local` / `xiaoyuan` |
| Grok Bot | `http://127.0.0.1:11340` | token `mock-token`                 |

Adding a provider: [[Architecture]] and [docs/architecture.md](https://github.com/XYAIStudio/xyai-xiaoyuan/blob/main/docs/architecture.md).
