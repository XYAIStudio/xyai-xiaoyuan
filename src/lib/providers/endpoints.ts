export const LIVE_DEFAULTS = {
  freeos: {
    id: "freeos",
    labelZh: "FreeOS / XYAI",
    url: "http://127.0.0.1:8088",
    port: 8088,
    path: "/api/setup/status",
    healthPath: "/api/health",
  },
  openxyos: {
    id: "openxyos",
    labelZh: "openXYOS 组织 OS",
    url: "http://127.0.0.1:3000",
    port: 3000,
    path: "/api/health",
  },
  grokbot: {
    id: "grokbot",
    labelZh: "本机 Grok Bot",
    url: "http://127.0.0.1:1340",
    port: 1340,
    path: "/health",
  },
  studio: {
    id: "xyai-studio",
    labelZh: "XYAI Studio（探测）",
    url: "http://127.0.0.1:5173",
    port: 5173,
    path: "/",
  },
} as const;

export const MOCK_DEFAULTS = {
  freeos: {
    id: "freeos-mock",
    labelZh: "模拟 FreeOS",
    url: "http://127.0.0.1:18088",
    port: 18088,
    path: "/api/setup/status",
  },
  openxyos: {
    id: "openxyos-mock",
    labelZh: "模拟 openXYOS",
    url: "http://127.0.0.1:13000",
    port: 13000,
    path: "/api/health",
  },
  grokbot: {
    id: "grokbot-mock",
    labelZh: "模拟 Grok Bot",
    url: "http://127.0.0.1:11340",
    port: 11340,
    path: "/health",
  },
} as const;

export const ENV_URL_KEYS = {
  freeos: "XYAI_FREEOS_URL",
  openxyos: "XYAI_OPENXYOS_URL",
  grokbot: "XYAI_GROKBOT_URL",
  studio: "XYAI_STUDIO_URL",
} as const;

export function parseHostPort(url: string): { host: string; port: number } | null {
  try {
    const parsed = new URL(url);
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === "https:"
        ? 443
        : 80;
    if (!Number.isFinite(port)) return null;
    return { host: parsed.hostname || "127.0.0.1", port };
  } catch {
    return null;
  }
}
