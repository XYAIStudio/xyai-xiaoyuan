#!/usr/bin/env node
/**
 * Local mock backends so 小元 can chat and switch poses without FreeOS / openXYOS / Grok Bot.
 *
 *   npm run mock:backends
 *
 * Then in 设置:
 *   FreeOS     http://127.0.0.1:18088   用户名/密码 xiaoyuan / xiaoyuan
 *   openXYOS   http://127.0.0.1:13000   邮箱/密码 xiaoyuan@xyai.local / xiaoyuan
 *   Grok Bot   http://127.0.0.1:11340   令牌 mock-token
 */
import http from "node:http";
import { listenFreeOsMock, mockReply } from "./lib/freeos-mock.mjs";

const HOST = "127.0.0.1";

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function bearer(req) {
  const header = String(req.headers.authorization || "");
  return header.replace(/^Bearer\s+/i, "").trim();
}

function pathOf(req) {
  return new URL(req.url || "/", "http://127.0.0.1").pathname;
}

function cors(req, res) {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return true;
  }
  return false;
}

function startFreeOs() {
  void listenFreeOsMock(18088, HOST).then(() => {
    console.log(`[mock] FreeOS    http://${HOST}:18088  (xiaoyuan / xiaoyuan)`);
  });
}

function startOpenXyos() {
  const server = http.createServer(async (req, res) => {
    if (cors(req, res)) return;
    const path = pathOf(req);
    if (req.method === "GET" && path === "/api/health") {
      json(res, 200, { product: "openXYOS-mock", status: "ready" });
      return;
    }
    if (req.method === "POST" && path === "/api/auth/login") {
      json(res, 200, {
        success: true,
        data: { tokens: { accessToken: "mock-openxyos-token" } },
      });
      return;
    }
    if (req.method === "GET" && path === "/api/auth/me") {
      json(res, 200, {
        data: { nickname: "模拟组织", email: "xiaoyuan@xyai.local" },
      });
      return;
    }
    if (req.method === "GET" && path === "/api/chats") {
      json(res, 200, { data: [{ id: "c1", title: "模拟会话" }] });
      return;
    }
    if (
      req.method === "GET" &&
      path.startsWith("/api/chats/") &&
      path.endsWith("/messages")
    ) {
      json(res, 200, { data: { messages: [] } });
      return;
    }
    if (req.method === "POST" && /\/api\/chats\/[^/]+\/messages$/.test(path)) {
      const body = await readBody(req);
      const reply = mockReply(body.content);
      json(res, 200, {
        data: [
          { id: "u1", sender_type: "user", content: body.content },
          { id: "a1", sender_type: "employee", content: reply },
        ],
      });
      return;
    }
    if (req.method === "POST" && path === "/api/assistant/chat") {
      const body = await readBody(req);
      json(res, 200, { reply: mockReply(body.message) });
      return;
    }
    json(res, 404, { error: `未实现 ${req.method} ${path}` });
  });
  server.listen(13000, HOST, () => {
    console.log(
      `[mock] openXYOS  http://${HOST}:13000  (xiaoyuan@xyai.local / xiaoyuan)`,
    );
  });
}

let grokBusy = false;
let grokTranscript = [];

function startGrok() {
  const server = http.createServer(async (req, res) => {
    if (cors(req, res)) return;
    const path = pathOf(req);
    if (req.method === "GET" && path === "/health") {
      json(res, 200, { ok: true, status: "ok", isBusy: grokBusy });
      return;
    }
    if (bearer(req) !== "mock-token" && path !== "/health") {
      json(res, 401, { error: "需要 Bearer mock-token" });
      return;
    }
    if (req.method === "POST" && path === "/api/listAgents") {
      json(res, 200, { agents: [{ id: "grok-mock", name: "Grok 模拟" }] });
      return;
    }
    if (req.method === "POST" && path === "/api/sendPrompt") {
      const body = await readBody(req);
      grokBusy = true;
      const reply = mockReply(body.prompt);
      grokTranscript = [
        { role: "user", content: body.prompt },
        { role: "assistant", content: reply },
      ];
      setTimeout(() => {
        grokBusy = false;
      }, 400);
      json(res, 200, { accepted: true });
      return;
    }
    if (req.method === "POST" && path === "/api/getAgentTranscript") {
      json(res, 200, grokTranscript);
      return;
    }
    if (req.method === "POST" && path === "/api/getTranscript") {
      json(res, 200, grokTranscript);
      return;
    }
    json(res, 404, { error: `未实现 ${req.method} ${path}` });
  });
  server.listen(11340, HOST, () => {
    console.log(`[mock] Grok Bot  http://${HOST}:11340  (token mock-token)`);
  });
}

startFreeOs();
startOpenXyos();
startGrok();
console.log("[mock] Ctrl+C 结束。桌面端：npm run tauri dev 后在设置里改地址。");
