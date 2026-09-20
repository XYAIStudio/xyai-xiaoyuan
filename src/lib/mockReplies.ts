/** Shared mock-gateway reply shaping so pose states can be exercised without live backends. */

export function mockShouldCallTool(text: string): boolean {
  return /(工具|tool call|搜索一下)/i.test(text);
}

export function mockAssistantReply(text: string): string {
  const trimmed = text.trim() || "你好";
  if (/(谢谢|感谢|比心)/.test(trimmed)) {
    return "不客气，小元一直在。";
  }
  if (/(画一|画张|创作|生成)/.test(trimmed)) {
    return "好，我来构思画面：星空下的小元挥手问好。";
  }
  return `小元已收到：「${trimmed.slice(0, 80)}」。这是本地模拟后端的回复，用来预览对话与姿态。`;
}

export function mockTokenChunks(text: string): string[] {
  const reply = mockAssistantReply(text);
  const chunks: string[] = [];
  for (const char of reply) chunks.push(char);
  return chunks;
}
