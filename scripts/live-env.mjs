#!/usr/bin/env node
/**
 * Print how to point 小元 at a live FreeOS / openXYOS / Grok Bot instance.
 *
 *   npm run live
 *   npm run live:freeos
 *   npm run live:openxyos
 *   npm run live:grokbot
 */
const PRESETS = {
  freeos: {
    label: "FreeOS / XYAI",
    env: "XYAI_FREEOS_URL",
    url: process.env.XYAI_FREEOS_URL || "http://127.0.0.1:8088",
    fields: "用户名 + 密码（钥匙串键 freeos_password）",
    notes: [
      "联调优先这一条：Windows 本机常见 127.0.0.1:8088 已开放。",
      "设置 → 后端 选「FreeOS / XYAI」，地址保持 http://127.0.0.1:8088。",
      "点「测试连接」应看到延迟毫秒数；失败时先 npm run doctor。",
    ],
  },
  openxyos: {
    label: "openXYOS 组织 OS",
    env: "XYAI_OPENXYOS_URL",
    url: process.env.XYAI_OPENXYOS_URL || "http://127.0.0.1:3000",
    fields: "邮箱 + 密码（钥匙串键 openxyos_password）",
    notes: [
      "仅当 :3000 已开再填。端口未开可忽略，继续用 FreeOS :8088。",
      "设置 → 后端 选「openXYOS 组织 OS」，地址填下面的 URL。",
      "对话可走小雄 /assistant/chat，或已有会话 /api/chats/:id/messages。",
    ],
  },
  grokbot: {
    label: "本机 Grok Bot",
    env: "XYAI_GROKBOT_URL",
    url: process.env.XYAI_GROKBOT_URL || "http://127.0.0.1:1340",
    fields: "Bearer 令牌（钥匙串键 grokbot_token），或从 gateway.json 导入",
    notes: [
      "仅建议 127.0.0.1 / 隧道。确认 GET /health 无鉴权可访问。",
      "设置 → 后端 选「本机 Grok Bot」。0.0.0.0 / :: 导入时会改写为 127.0.0.1。",
      "路径可能随网关版本变化；失败时看 docs/live-integration.md。",
    ],
  },
};

function printPreset(id) {
  const preset = PRESETS[id];
  if (!preset) {
    console.error(`未知后端：${id}（可用 freeos / openxyos / grokbot）`);
    process.exit(1);
  }
  console.log(`小元 联调 · ${preset.label}`);
  console.log(`  环境变量  ${preset.env}=${preset.url}`);
  console.log(`  设置地址  ${preset.url}`);
  console.log(`  凭证      ${preset.fields}`);
  for (const note of preset.notes) console.log(`  - ${note}`);
  console.log("");
}

const arg = (process.argv[2] || "all").replace(/^:+/, "");
if (arg === "all" || arg === "help") {
  console.log(
    "把小元指到真实本机后端（密钥勿提交）。推荐顺序：FreeOS :8088 → Grok Bot :1340。openXYOS :3000 未开可跳过。也可 npm run mock:backends。\n",
  );
  for (const id of Object.keys(PRESETS)) printPreset(id);
  console.log("探活：npm run doctor");
  console.log("说明：docs/live-freeos.md");
} else {
  printPreset(arg);
}
