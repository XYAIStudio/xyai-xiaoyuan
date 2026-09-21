/**
 * Shared live-联调 recommendation. Prefer FreeOS on 127.0.0.1:8088.
 * Keep wording in sync with src/lib/providers/liveHint.ts.
 */
export const PREFERRED_LIVE_ID = "freeos";
export const PREFERRED_LIVE_PORT = 8088;
export const PREFERRED_LIVE_URL = "http://127.0.0.1:8088";

/**
 * @param {{ id: string, base?: string, ok?: boolean, tcpOpen?: boolean }[]} live
 * @param {{ ok?: boolean }[]} [mock]
 */
export function recommendLiveHint(live, mock = []) {
  const freeos = live.find((row) => row.id === "freeos");
  const openxyos = live.find((row) => row.id === "openxyos");
  const grokbot = live.find((row) => row.id === "grokbot");
  const mockOk = mock.some((row) => row.ok);
  const freeosBase = freeos?.base || PREFERRED_LIVE_URL;
  const skip3000 =
    openxyos && !openxyos.ok && openxyos.tcpOpen !== true
      ? " openXYOS :3000 未开可忽略。"
      : "";

  if (freeos?.ok) {
    return `优先对接 FreeOS：${freeosBase}（HTTP 已就绪）。在设置 → 后端 选「FreeOS / XYAI」后点「测试连接」。${skip3000}`.trim();
  }
  if (freeos?.tcpOpen) {
    return `本机 ${PREFERRED_LIVE_PORT} 端口已开放，优先对接 FreeOS：${freeosBase}。设置里填该地址并测试连接；HTTP 探活未通过时仍先试 FreeOS，不要改去 :3000。${skip3000}`.trim();
  }
  if (grokbot?.ok || grokbot?.tcpOpen) {
    return `FreeOS :${PREFERRED_LIVE_PORT} 未开。可先试本机 Grok Bot ${grokbot.base || "http://127.0.0.1:1340"}。${skip3000}`.trim();
  }
  if (openxyos?.ok || openxyos?.tcpOpen) {
    return `FreeOS :${PREFERRED_LIVE_PORT} 未开，openXYOS ${openxyos.base} 可探到。默认仍建议先起 FreeOS :8088。`;
  }
  if (mockOk) {
    return "真实 FreeOS :8088 未开。模拟网关已就绪时，把设置地址改成 18088 / 13000 / 11340 后点「测试连接」。";
  }
  return `当前没有探到可用服务。联调优先启动 FreeOS（${PREFERRED_LIVE_URL}），或运行 npm run mock:backends。详见 docs/live-freeos.md`;
}
