import type {
  BackendProvider,
  ConnectionTestResult,
  SendChatHandle,
  SendChatInput,
} from "./types";
import { clientFetch, normalizeBaseUrl } from "./http";

export const xyaiStudioProvider: BackendProvider = {
  id: "xyai-studio",
  labelZh: "XYAI Studio 桌面工作台",
  labelEn: "XYAI Studio",
  repoUrl: "https://github.com/XYAIStudio/xyai-studio",
  ready: false,
  notReadyReason:
    "未就绪：XYAI Studio 是本地优先 Electron 工作台，公开仓库未提供桌宠可调用的远程 listAgents / 对话 HTTP API。现有互通为 Studio → openXYOS（POST /api/xyai/agents/import 等，请求头 X-XYAI-Interop: studio），不是反向聊天。",
  supportsThreads: false,
  defaultBaseUrl: "http://127.0.0.1:5173",
  secretKeys: ["studio_token"],

  async testConnection(ctx): Promise<ConnectionTestResult> {
    if (!ctx.baseUrl.trim()) {
      return {
        ok: false,
        message: "未就绪：请等待 Studio 暴露远程对话接口后再启用",
      };
    }
    try {
      const url = normalizeBaseUrl(ctx.baseUrl);
      const res = await clientFetch(url);
      return {
        ok: false,
        message: `探测到 ${url}（HTTP ${res.status}），但尚未发现桌宠可用的 listAgents / 对话端点`,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? `未就绪：${error.message}`
            : "未就绪：无法探测 XYAI Studio",
      };
    }
  },

  async listAgents() {
    throw new Error("XYAI Studio 远程对话 API 尚未就绪");
  },

  async sendChat(_ctx, input: SendChatInput): Promise<SendChatHandle> {
    input.onError?.("XYAI Studio 远程对话 API 尚未就绪");
    return { cancel: () => undefined };
  },
};
