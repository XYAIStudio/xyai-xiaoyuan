/**
 * In-process FreeOS HTTP mock that mirrors the live :8088 contract.
 *
 * Paths match XYAIStudio/FreeOS routers:
 *   GET  /api/health
 *   GET  /api/setup/status
 *   POST /api/auth/login   {username,password} → {access_token,user}
 *   GET  /api/auth/me
 *   GET  /api/agents
 *   POST /api/agents/{id}/threads                 (live)
 *   POST /api/agents/{id}/chat/sessions           (docs alias)
 *   GET  /api/agents/{id}/threads/{id}/history
 *   GET  /api/agents/{id}/chat/sessions/{id}/history
 *   WS   /api/agents/{id}/chat/ws?token=
 *
 * Demo account: xiaoyuan / xiaoyuan
 */
import http from "node:http";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";

export const FREEOS_MOCK_USER = "xiaoyuan";
export const FREEOS_MOCK_PASSWORD = "xiaoyuan";
export const FREEOS_MOCK_TOKEN = "mock-freeos-token";

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

function octopError(res, status, code, message) {
  json(res, status, { error: { code, message, details: {} } });
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

function requireToken(req, res) {
  if (bearer(req) !== FREEOS_MOCK_TOKEN) {
    octopError(res, 401, "AUTH_FAILED", "invalid credentials");
    return false;
  }
  return true;
}

export function mockReply(text) {
  const trimmed = String(text || "").trim() || "你好";
  if (/(谢谢|感谢|比心)/.test(trimmed)) return "不客气，小元一直在。";
  if (/(画一|画张|创作|生成)/.test(trimmed)) {
    return "好，我来构思画面：星空下的小元挥手问好。";
  }
  return `小元已收到：「${trimmed.slice(0, 80)}」。这是本地模拟后端的回复，用来预览对话与姿态。`;
}

export async function handleFreeOsHttp(req, res, options = {}) {
  const setupRequired = options.setupRequired === true;
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return true;
  }
  const path = pathOf(req);

  if (req.method === "GET" && path === "/api/health") {
    json(res, 200, { status: "ok", version: "mock" });
    return true;
  }
  if (req.method === "GET" && path === "/api/setup/status") {
    json(res, 200, {
      setup_required: setupRequired,
      wizard_password_required: false,
      has_providers: !setupRequired,
    });
    return true;
  }
  if (req.method === "POST" && path === "/api/auth/login") {
    if (setupRequired) {
      octopError(res, 409, "SETUP_REQUIRED", "initial admin not created");
      return true;
    }
    const body = await readBody(req);
    if (body.username !== FREEOS_MOCK_USER || body.password !== FREEOS_MOCK_PASSWORD) {
      octopError(res, 401, "AUTH_FAILED", "invalid credentials");
      return true;
    }
    json(res, 200, {
      access_token: FREEOS_MOCK_TOKEN,
      token_type: "Bearer",
      expires_in: 86400,
      user: { username: FREEOS_MOCK_USER, display_name: "模拟小元", role: "admin" },
    });
    return true;
  }
  if (req.method === "GET" && path === "/api/auth/me") {
    if (!requireToken(req, res)) return true;
    json(res, 200, { username: FREEOS_MOCK_USER, display_name: "模拟小元", role: "admin" });
    return true;
  }
  if (req.method === "GET" && path === "/api/agents") {
    if (!requireToken(req, res)) return true;
    json(res, 200, [
      { id: 1, agent_id: "xiaoyuan", name: "小元（模拟）", state: "idle" },
    ]);
    return true;
  }
  if (req.method === "POST" && /\/api\/agents\/[^/]+\/(threads|chat\/sessions)$/.test(path)) {
    if (!requireToken(req, res)) return true;
    json(res, 201, { thread_id: "thread-mock", session_key: "session-mock" });
    return true;
  }
  if (
    req.method === "GET" &&
    /\/api\/agents\/[^/]+\/(threads|chat\/sessions)\/[^/]+\/history/.test(path)
  ) {
    if (!requireToken(req, res)) return true;
    json(res, 200, { thread_id: "thread-mock", messages: [], has_more: false });
    return true;
  }
  json(res, 404, { detail: `未实现 ${req.method} ${path}` });
  return true;
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export function attachFreeOsUpgrade(server) {
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
}

export function createFreeOsMockServer(options = {}) {
  const server = http.createServer((req, res) => {
    void handleFreeOsHttp(req, res, options);
  });
  attachFreeOsUpgrade(server);
  return server;
}

export function listenFreeOsMock(port, host = "127.0.0.1", options = {}) {
  const server = createFreeOsMockServer(options);
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolve({ server, port: actualPort, url: `http://${host}:${actualPort}` });
    });
  });
}
