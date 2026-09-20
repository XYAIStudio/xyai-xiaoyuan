import { useCallback, useEffect, useRef, useState } from "react";

import { chatErrorText, nextChatMessageId } from "../lib/chatHelpers";
import {
  activeBaseUrl,
  activeUsername,
  resolveThreadForAgent,
  withThreadForAgent,
} from "../lib/configLogic";
import {
  enqueueChatItem,
  shiftChatItem,
  type QueuedChatItem,
} from "../lib/messageQueue";
import { getProvider } from "../lib/providers/registry";
import type { ProviderId, ProviderContext } from "../lib/providers/types";
import { poseHintFromUserText } from "../lib/poseMachine";
import { withRetry } from "../lib/retry";
import { tauriApi } from "../lib/tauriApi";
import type { AgentSummary, AppConfig, ChatMessage } from "../lib/types";

export function useChatController() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentId, setAgentId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<
    "loading" | "connected" | "disconnected" | "streaming"
  >("loading");
  const [needsSettings, setNeedsSettings] = useState(false);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<QueuedChatItem[]>([]);
  const [composer, setComposer] = useState("");
  const [providerId, setProviderId] = useState<ProviderId>("freeos");

  const configRef = useRef<AppConfig | null>(null);
  const queueRef = useRef<QueuedChatItem[]>([]);
  queueRef.current = queue;
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const handleRef = useRef<{ cancel: () => void } | null>(null);
  const sendNowRef = useRef<(text: string) => Promise<void>>(async () => undefined);
  const loadSeq = useRef(0);
  const mounted = useRef(true);

  const contextOf = useCallback((cfg: AppConfig): ProviderContext => {
    return {
      baseUrl: activeBaseUrl(cfg),
      username: activeUsername(cfg),
      getSecret: tauriApi.getSecret,
      setSecret: tauriApi.setSecret,
      deleteSecret: tauriApi.deleteSecret,
    };
  }, []);

  const emitLife = useCallback((life: string) => {
    void tauriApi.emitPetLifecycle(life);
  }, []);

  const stop = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    emitLife("idle");
  }, [emitLife]);

  const openAgent = useCallback(
    async (nextId: string) => {
      const cfg = configRef.current;
      if (!cfg) return;
      const provider = getProvider(cfg.providerId);
      stop();
      const seq = ++loadSeq.current;
      setAgentId(nextId);
      setMessages([]);
      setQueue([]);
      setError("");
      setConnection("loading");
      emitLife("connecting");
      try {
        let threadId = resolveThreadForAgent(cfg, nextId);
        let history: ChatMessage[] = [];
        if (provider.supportsThreads && provider.ensureThread) {
          if (!threadId) {
            const created = await provider.ensureThread(contextOf(cfg), nextId);
            threadId = created.threadId;
          }
          const nextCfg = withThreadForAgent(cfg, nextId, threadId);
          await tauriApi.patchConfig({
            lastAgentId: nextCfg.lastAgentId,
            threadIdByAgent: nextCfg.threadIdByAgent,
          });
          configRef.current = nextCfg;
        }
        if (provider.loadHistory) {
          try {
            history = await provider.loadHistory(
              contextOf(cfg),
              nextId,
              threadId ?? nextId,
            );
          } catch {
            history = [];
          }
        }
        if (seq !== loadSeq.current || !mounted.current) return;
        setMessages(history);
        setConnection("connected");
        emitLife("idle");
      } catch (loadError) {
        if (seq !== loadSeq.current || !mounted.current) return;
        setError(chatErrorText(loadError));
        setConnection("disconnected");
        emitLife("error");
      }
    },
    [contextOf, emitLife, stop],
  );

  const initialize = useCallback(async () => {
    const seq = ++loadSeq.current;
    setConnection("loading");
    setError("");
    emitLife("connecting");
    try {
      const cfg = await tauriApi.loadConfig();
      if (seq !== loadSeq.current || !mounted.current) return;
      configRef.current = cfg;
      setProviderId(cfg.providerId);
      const provider = getProvider(cfg.providerId);
      if (!provider.ready) {
        setNeedsSettings(true);
        setError(provider.notReadyReason || "当前后端尚未就绪");
        setConnection("disconnected");
        emitLife("error");
        return;
      }
      const available = await withRetry(() => provider.listAgents(contextOf(cfg)), {
        attempts: 3,
        delayMs: 400,
      });
      if (seq !== loadSeq.current || !mounted.current) return;
      if (available.length === 0) {
        setError("没有可用智能体 / 会话");
        setConnection("disconnected");
        return;
      }
      setAgents(available);
      setNeedsSettings(false);
      const selected =
        available.find((agent) => agent.id === cfg.lastAgentId) ?? available[0];
      await openAgent(selected.id);
    } catch (initError) {
      if (seq !== loadSeq.current || !mounted.current) return;
      setNeedsSettings(true);
      setError(chatErrorText(initError));
      setConnection("disconnected");
      emitLife("error");
      await tauriApi.showSettings().catch(() => undefined);
    }
  }, [contextOf, emitLife, openAgent]);

  const sendNow = useCallback(
    async (text: string) => {
      const cfg = configRef.current;
      if (!cfg || !agentId) return;
      const provider = getProvider(cfg.providerId);
      const history = messagesRef.current;
      const userMsg: ChatMessage = {
        id: nextChatMessageId("user"),
        role: "user",
        content: text,
      };
      const assistantId = nextChatMessageId("asst");
      setMessages((current) => [
        ...current,
        userMsg,
        { id: assistantId, role: "assistant", content: "", pending: true },
      ]);
      setConnection("streaming");
      const hint = poseHintFromUserText(text);
      emitLife(hint === "create" ? "create" : "thinking");
      const threadId = resolveThreadForAgent(cfg, agentId);
      handleRef.current = await provider.sendChat(contextOf(cfg), {
        agentId,
        text,
        threadId,
        history,
        onLifecycle: (life) => {
          if (hint === "create" && (life === "thinking" || life === "streaming")) {
            emitLife("create");
            return;
          }
          emitLife(life);
        },
        onAssistantDelta: (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: delta, pending: true }
                : message,
            ),
          );
        },
        onDone: (finalText) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: finalText || message.content, pending: false }
                : message,
            ),
          );
          setConnection("connected");
          emitLife(hint === "affection" ? "affection" : "success");
          window.setTimeout(() => emitLife("idle"), 1800);
          handleRef.current = null;
          const next = shiftChatItem(queueRef.current);
          if (next.item) {
            setQueue(next.queue);
            void sendNowRef.current(next.item.text);
          }
        },
        onError: (message) => {
          setMessages((current) =>
            current.map((row) =>
              row.id === assistantId
                ? {
                    ...row,
                    pending: false,
                    error: message,
                    content: row.content || message,
                  }
                : row,
            ),
          );
          setConnection("connected");
          emitLife("error");
          handleRef.current = null;
        },
      });
    },
    [agentId, contextOf, emitLife],
  );
  sendNowRef.current = sendNow;

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (connectionRef.current === "streaming") {
        const item: QueuedChatItem = {
          id: nextChatMessageId("q"),
          text: trimmed,
          createdAt: Date.now(),
        };
        const result = enqueueChatItem(queueRef.current, item);
        if (!result.ok) {
          setError("队列已满（最多 5 条）");
          return;
        }
        setQueue(result.queue);
        return;
      }
      await sendNow(trimmed);
    },
    [sendNow],
  );

  useEffect(() => {
    mounted.current = true;
    void initialize();
    let unlistenAuth: (() => void) | undefined;
    let unlistenShown: (() => void) | undefined;
    void tauriApi
      .listenAuthUpdated(() => {
        if (mounted.current) void initialize();
      })
      .then((fn) => {
        unlistenAuth = fn;
      });
    void tauriApi
      .listenChatShown(() => {
        if (mounted.current && connectionRef.current === "disconnected")
          void initialize();
      })
      .then((fn) => {
        unlistenShown = fn;
      });
    return () => {
      mounted.current = false;
      stop();
      unlistenAuth?.();
      unlistenShown?.();
    };
  }, [initialize, stop]);

  return {
    agents,
    agentId,
    providerId,
    messages,
    connection,
    needsSettings,
    error,
    queue,
    composer,
    setComposer,
    setAgentId: openAgent,
    send,
    stop,
    initialize,
    startNewSession: async () => {
      const cfg = configRef.current;
      if (!cfg || !agentId) return;
      const provider = getProvider(cfg.providerId);
      if (!provider.ensureThread) {
        setMessages([]);
        return;
      }
      const created = await provider.ensureThread(contextOf(cfg), agentId);
      const next = withThreadForAgent(cfg, agentId, created.threadId);
      await tauriApi.patchConfig({
        lastAgentId: next.lastAgentId,
        threadIdByAgent: next.threadIdByAgent,
      });
      configRef.current = next;
      setMessages([]);
    },
  };
}
