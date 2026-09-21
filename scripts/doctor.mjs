#!/usr/bin/env node
/**
 * Probe default localhost backends and print a Chinese status table.
 *
 *   npm run doctor
 *
 * Prefers FreeOS on 127.0.0.1:8088. Reads optional XYAI_*_URL overrides
 * from the environment (see .env.example).
 */
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { pathToFileURL } from "node:url";

import { recommendLiveHint } from "./live-hint.mjs";

const LIVE = [
  {
    id: "freeos",
    label: "FreeOS / XYAI（优先）",
    env: "XYAI_FREEOS_URL",
    fallback: "http://127.0.0.1:8088",
    path: "/api/setup/status",
    altPaths: ["/api/health"],
  },
  {
    id: "openxyos",
    label: "openXYOS 组织 OS",
    env: "XYAI_OPENXYOS_URL",
    fallback: "http://127.0.0.1:3000",
    path: "/api/health",
  },
  {
    id: "grokbot",
    label: "本机 Grok Bot",
    env: "XYAI_GROKBOT_URL",
    fallback: "http://127.0.0.1:1340",
    path: "/health",
  },
  {
    id: "studio",
    label: "XYAI Studio（探测）",
    env: "XYAI_STUDIO_URL",
    fallback: "http://127.0.0.1:5173",
    path: "/",
  },
];

const MOCK = [
  {
    id: "freeos-mock",
    label: "模拟 FreeOS",
    fallback: "http://127.0.0.1:18088",
    path: "/api/setup/status",
    altPaths: ["/api/health"],
  },
  {
    id: "openxyos-mock",
    label: "模拟 openXYOS",
    fallback: "http://127.0.0.1:13000",
    path: "/api/health",
  },
  {
    id: "grokbot-mock",
    label: "模拟 Grok Bot",
    fallback: "http://127.0.0.1:11340",
    path: "/health",
  },
];

function originOf(raw) {
  const trimmed = String(raw || "")
    .trim()
    .replace(/\/+$/, "");
  return trimmed || null;
}

function joinUrl(base, path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function hostPortOf(base, fallbackPort) {
  try {
    const parsed = new URL(base);
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "https:"
        ? 443
        : 80;
    return { host: parsed.hostname || "127.0.0.1", port };
  } catch {
    return { host: "127.0.0.1", port: fallbackPort };
  }
}

function tcpProbe(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (tcpOpen) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ tcpOpen });
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      finish(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      finish(false);
    });
  });
}

function requestOnce(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const started = Date.now();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, ms: Date.now() - started });
    };
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      finish({ ok: false, status: 0, error: "地址无效" });
      return;
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        timeout: timeoutMs,
        headers: { Accept: "application/json, text/plain, */*" },
      },
      (res) => {
        res.resume();
        finish({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500,
          status: res.statusCode ?? 0,
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, status: 0, error: "超时" });
    });
    req.on("error", (error) => {
      const code =
        error && typeof error === "object" && "code" in error ? error.code : "";
      if (code === "ECONNREFUSED") {
        finish({ ok: false, status: 0, error: "未启动" });
        return;
      }
      if (code === "ENOTFOUND") {
        finish({ ok: false, status: 0, error: "主机名无效" });
        return;
      }
      finish({ ok: false, status: 0, error: "无法连接" });
    });
    req.end();
  });
}

function pad(text, width) {
  const value = String(text);
  const extra = Math.max(0, width - [...value].length);
  return value + " ".repeat(extra);
}

async function probeRow(row) {
  const base = originOf(process.env[row.env] || row.fallback) || row.fallback;
  const { host, port } = hostPortOf(base, 80);
  const tcp = await tcpProbe(host, port);
  const paths = [row.path, ...(row.altPaths || [])];
  let result = { ok: false, status: 0, error: "未探测", ms: 0 };
  let url = joinUrl(base, row.path);
  for (const path of paths) {
    const candidate = joinUrl(base, path);
    result = await requestOnce(candidate);
    url = candidate;
    if (result.ok) break;
  }
  return { ...row, base, url, host, port, ...tcp, ...result };
}

function formatDetail(row) {
  if (row.ok) {
    return `端口开放  HTTP 就绪  ${row.ms}ms  HTTP ${row.status}`;
  }
  if (row.tcpOpen) {
    return `端口开放  HTTP 未就绪  ${row.ms}ms  ${row.error || ""}`.trim();
  }
  return `端口未开  ${row.error || "未启动"}  ${row.ms}ms`;
}

function printGroup(title, rows) {
  console.log(title);
  for (const row of rows) {
    const mark = row.ok ? "✓" : row.tcpOpen ? "~" : "✗";
    console.log(
      `  ${mark}  ${pad(row.label, 22)}  ${pad(row.base, 28)}  ${formatDetail(row)}`,
    );
  }
}

export async function runDoctor() {
  console.log("小元 联调探活（只访问本机地址，不上传任何内容）");
  console.log("优先检查 FreeOS http://127.0.0.1:8088 ；openXYOS :3000 未开可忽略。\n");
  const live = [];
  for (const row of LIVE) live.push(await probeRow(row));
  const mock = [];
  for (const row of MOCK) mock.push(await probeRow(row));
  printGroup("真实后端默认端口（优先 :8088）", live);
  console.log("");
  printGroup("模拟网关（npm run mock:backends）", mock);
  console.log("");
  console.log(`提示：${recommendLiveHint(live, mock)}`);
  return { live, mock };
}

const isDirect = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  runDoctor().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
