#!/usr/bin/env node
/**
 * Probe default localhost backends and print a Chinese status table.
 *
 *   npm run doctor
 *
 * Reads optional XYAI_*_URL overrides from the environment (see .env.example).
 */
import http from "node:http";
import https from "node:https";
import { pathToFileURL } from "node:url";

const LIVE = [
  {
    id: "freeos",
    label: "FreeOS / XYAI",
    env: "XYAI_FREEOS_URL",
    fallback: "http://127.0.0.1:8088",
    path: "/api/setup/status",
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
  const url = joinUrl(base, row.path);
  const result = await requestOnce(url);
  return { ...row, base, url, ...result };
}

function printGroup(title, rows) {
  console.log(title);
  for (const row of rows) {
    const mark = row.ok ? "✓" : "✗";
    const detail = row.ok
      ? `就绪  ${row.ms}ms  HTTP ${row.status}`
      : `${row.error || "失败"}  ${row.ms}ms`;
    console.log(`  ${mark}  ${pad(row.label, 20)}  ${pad(row.base, 28)}  ${detail}`);
  }
}

export async function runDoctor() {
  console.log("小元 联调探活（只访问本机地址，不上传任何内容）\n");
  const live = [];
  for (const row of LIVE) live.push(await probeRow(row));
  const mock = [];
  for (const row of MOCK) mock.push(await probeRow(row));
  printGroup("真实后端默认端口", live);
  console.log("");
  printGroup("模拟网关（npm run mock:backends）", mock);
  console.log("");
  const liveOk = live.filter((row) => row.ok && row.id !== "studio").length;
  const mockOk = mock.filter((row) => row.ok).length;
  if (liveOk === 0 && mockOk === 0) {
    console.log(
      "提示：当前没有探到可用服务。先启动 FreeOS / openXYOS / 本机 Grok Bot，或运行 npm run mock:backends。详见 docs/live-integration.md",
    );
  } else if (liveOk === 0 && mockOk > 0) {
    console.log(
      "提示：模拟网关已就绪。在设置里把地址改成 18088 / 13000 / 11340 后点「测试连接」。",
    );
  } else {
    console.log(
      "提示：把设置 → 后端 的地址改成上表「就绪」的那一行，再点「测试连接」。",
    );
  }
  return { live, mock };
}

const isDirect = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  runDoctor().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
