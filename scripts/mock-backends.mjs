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
import { Buffer } from "node:buffer";
import crypto from "node:crypto";

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

function mockReply(text) {
  const trimmed = String(text || "").trim() || "你好";
  if (/(谢谢|感谢|比心)/.test(trimmed)) return "不客气，小元一直在。";
  if (/(画一|画张|创作|生成)/.test(trimmed)) {
    return "好，我来构思画面：星空下的小元挥手问好。";
  }
  return `小元已收到：「${trimmed.slice(0, 80)}」。这是本地模拟后端的回复，用来预览对话与姿态。`;
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
  const server = http.createServer(async (req, res) => {
    if (cors(req, res)) return;
    const path = pathOf(req);
    if (req.method === "GET" && path === "/api/setup/status") {
      json(res, 200, { setup_required: false });
      return;
    }
    if (req.method === "POST" && path === "/api/auth/login") {
      const body = await readBody(req);
      if (!body.username || !body.password) {
        json(res, 400, { detail: "需要用户名和密码（演示可用 xiaoyuan / xiaoyuan）" });
        return;
      }
      json(res, 200, { access_token: "mock-freeos-token" });
      return;
    }
    if (req.method === "GET" && path === "/api/auth/me") {
      json(res, 200, { username: "xiaoyuan", display_name: "模拟小元" });
      return;
    }
    if (req.method === "GET" && path === "/api/agents") {
      json(res, 200, [{ id: "xiaoyuan", name: "小元（模拟）", state: "idle" }]);
      return;
    }
    if (req.method === "POST" && /\/api\/agents\/[^/]+\/threads$/.test(path)) {
      json(res, 200, { thread_id: "thread-mock", session_key: "session-mock" });
      return;
    }
    if (
      req.method === "GET" &&
      /\/api\/agents\/[^/]+\/threads\/[^/]+\/history/.test(path)
    ) {
      json(res, 200, { messages: [] });
      return;
    }
    json(res, 404, { detail: `未实现 ${req.method} ${path}` });
  });

  server.on("upgrade", (req, socket) => {
    const path = pathOf(req);
    if (!path.includes("/chat/ws")) {
      socket.destroy();
      return;
    }
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }
    const accept = websocketAccept(String(key));
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
        accept +
        "\r\n\r\n",
    );
    let buffer = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const frame = decodeFrame(buffer);
      if (!frame) return;
      buffer = frame.rest;
      if (frame.opcode === 8) {
        socket.end();
        return;
      }
      if (frame.opcode !== 1) return;
      let payload = {};
      try {
        payload = JSON.parse(frame.payload.toString("utf8"));
      } catch {
        payload = {};
      }
      const text = String(payload.text || payload.messages?.[0]?.content || "");
      void streamFreeOs(socket, text);
    });
  });

  server.listen(18088, HOST, () => {
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

async function streamFreeOs(socket, text) {
  if (/(工具|tool call|搜索一下)/i.test(text)) {
    sendFrame(socket, JSON.stringify({ type: "tool_call_chunk" }));
    await delay(80);
  }
  const reply = mockReply(text);
  for (const char of reply) {
    sendFrame(socket, JSON.stringify({ type: "token", content: char }));
    await delay(18);
  }
  sendFrame(socket, JSON.stringify({ type: "done" }));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function websocketAccept(key) {
  return crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    return null;
  }
  const maskOffset = offset;
  const dataOffset = masked ? offset + 4 : offset;
  if (buffer.length < dataOffset + length) return null;
  const payload = Buffer.from(buffer.subarray(dataOffset, dataOffset + length));
  if (masked) {
    const mask = buffer.subarray(maskOffset, maskOffset + 4);
    for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
  }
  return { opcode, payload, rest: buffer.subarray(dataOffset + length) };
}

function sendFrame(socket, text) {
  const payload = Buffer.from(text, "utf8");
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = payload.length;
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

startFreeOs();
startOpenXyos();
startGrok();
console.log("[mock] Ctrl+C 结束。桌面端：npm run tauri dev 后在设置里改地址。");
