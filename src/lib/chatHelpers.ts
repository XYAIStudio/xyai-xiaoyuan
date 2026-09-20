import { ProviderHttpError } from "./providers/http";
import type { ChatMessage } from "./types";

let nextMessageId = 0;

export function nextChatMessageId(prefix: string): string {
  nextMessageId += 1;
  return `${prefix}-${nextMessageId}`;
}

export function chatErrorText(error: unknown): string {
  if (error instanceof ProviderHttpError) {
    if (error.status === 401) return "登录已失效，请重新设置账号";
    if (!error.message.startsWith("HTTP ")) {
      return `服务请求失败：${error.message}`;
    }
    return `服务请求失败（${error.status}）`;
  }
  return error instanceof Error ? error.message : "连接服务失败";
}

export function toChatMessages(
  rows: ChatMessage[] | Array<{ role: string; content: string }>,
): ChatMessage[] {
  return rows.map((row, index) => ({
    id: "id" in row && row.id ? row.id : nextChatMessageId(`h-${index}`),
    role: row.role as ChatMessage["role"],
    content: row.content,
  }));
}
