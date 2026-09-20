import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { queuedPreview } from "../lib/messageQueue";
import { BACKEND_PROVIDERS } from "../lib/providers/registry";
import { useChatController } from "../hooks/useChatController";
import { hideCurrentWindow } from "../lib/tauriWindowApi";
import { tauriApi } from "../lib/tauriApi";

export default function ChatWindow() {
  const chat = useChatController();

  return (
    <div className="chat-root">
      <header className="chat-header" onPointerDown={() => undefined}>
        <div>
          <strong>小元对话</strong>
          <span className={`chat-badge is-${chat.connection}`}>
            {chat.connection === "streaming"
              ? "生成中"
              : chat.connection === "connected"
                ? "已连接"
                : chat.connection === "loading"
                  ? "连接中"
                  : "未连接"}
          </span>
        </div>
        <div className="chat-header-actions">
          <button type="button" onClick={() => void chat.startNewSession()}>
            新会话
          </button>
          <button type="button" onClick={() => void tauriApi.showSettings()}>
            设置
          </button>
          <button
            type="button"
            className="chat-close"
            onClick={() => void hideCurrentWindow()}
          >
            ×
          </button>
        </div>
      </header>
      <div className="chat-toolbar">
        <select
          value={chat.agentId}
          onChange={(event) => void chat.setAgentId(event.target.value)}
        >
          {chat.agents.length === 0 ? <option value="">选择智能体</option> : null}
          {chat.agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        <span className="chat-provider-hint">
          {BACKEND_PROVIDERS.find((item) => item.id === chat.providerId)?.labelZh ??
            chat.providerId}
        </span>
      </div>
      <div className="chat-body">
        {chat.needsSettings ? (
          <p className="chat-empty">
            请先在设置中选择后端并测试连接。
            <button type="button" onClick={() => void tauriApi.showSettings()}>
              打开设置
            </button>
          </p>
        ) : null}
        {chat.error ? (
          <p className="chat-error">
            {chat.error}
            {chat.connection === "disconnected" ? (
              <button type="button" onClick={() => void chat.initialize()}>
                重新连接
              </button>
            ) : null}
          </p>
        ) : null}
        {chat.messages.map((message) => (
          <article key={message.id} className={`bubble is-${message.role}`}>
            {message.role === "assistant" ? (
              <Markdown remarkPlugins={[remarkGfm]}>{message.content || "…"}</Markdown>
            ) : (
              <p>{message.content}</p>
            )}
            {message.error ? <small>{message.error}</small> : null}
          </article>
        ))}
      </div>
      {chat.queue.length > 0 ? (
        <ul className="chat-queue">
          {chat.queue.map((item) => (
            <li key={item.id}>排队：{queuedPreview(item)}</li>
          ))}
        </ul>
      ) : null}
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          const text = chat.composer;
          chat.setComposer("");
          void chat.send(text);
        }}
      >
        <textarea
          rows={2}
          placeholder="和小元说点什么… Enter 发送"
          value={chat.composer}
          onChange={(event) => chat.setComposer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              const text = chat.composer;
              chat.setComposer("");
              void chat.send(text);
            }
          }}
        />
        {chat.connection === "streaming" ? (
          <button type="button" onClick={() => chat.stop()}>
            停止
          </button>
        ) : (
          <button type="submit">发送</button>
        )}
      </form>
    </div>
  );
}
