import React, { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  Loader2,
  Square,
  FileText,
  Zap,
  Brain,
  Copy as CopyIcon,
  Check as CheckIcon,
  ArrowUp,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { API_CONFIG } from "../config/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";
// import { Button } from "./ui/button";

interface ChatPanelProps {
  contractId: string;
  solicitationId?: string;
  isVisible?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  meta?: {
    model?: string;
    tokensPerSec?: number;
    durationMs?: number;
    feedback?: number;
  };
}

type Phase = "idle" | "queued" | "thinking" | "responding";
type ModelChoice = "fast" | "smart";

export default function ChatPanel({
  contractId,
  solicitationId,
  isVisible = true,
}: ChatPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [ctxReady, setCtxReady] = useState<boolean>(true);
  const [ctxBusy, setCtxBusy] = useState<boolean>(false);
  const [model, setModel] = useState<ModelChoice>(() => {
    try {
      const v = localStorage.getItem("chatModelChoice");
      return (v as ModelChoice) || "fast";
    } catch {
      return "fast";
    }
  });
  const [showModelCard, setShowModelCard] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [feedbackPulse, setFeedbackPulse] = useState<{
    id: string;
    type: "up" | "down";
  } | null>(null);

  // Rotating thinking/queued phrases
  const thinkingPhrases = React.useMemo(
    () => [
      "Thinking…",
      "Reviewing documents…",
      "Extracting key details…",
      "Cross‑checking requirements…",
      "Drafting a clear answer…",
    ],
    []
  );
  const [thinkingIdx, setThinkingIdx] = useState(0);
  useEffect(() => {
    if (phase === "thinking" || phase === "queued") {
      const id = window.setInterval(() => {
        setThinkingIdx((i) => (i + 1) % thinkingPhrases.length);
      }, 2000);
      return () => window.clearInterval(id);
    }
    // reset on idle/responding
    setThinkingIdx(0);
    return undefined;
  }, [phase, thinkingPhrases.length]);

  // Typing effect state
  const typingBufferRef = useRef<string>("");
  const typingTimerRef = useRef<number | null>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const tokenCountRef = useRef<number>(0);
  const respondingStartRef = useRef<number | null>(null);

  const startTypingInterval = (assistantId: string) => {
    currentAssistantIdRef.current = assistantId;
    if (typingTimerRef.current !== null) return;
    typingTimerRef.current = window.setInterval(() => {
      if (!typingBufferRef.current || !currentAssistantIdRef.current) {
        // Nothing to flush right now; if not responding, stop
        if (phase !== "responding") {
          if (typingTimerRef.current !== null) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
          }
        }
        return;
      }
      const step = Math.min(typingBufferRef.current.length, 6); // faster
      const chunk = typingBufferRef.current.slice(0, step);
      typingBufferRef.current = typingBufferRef.current.slice(step);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === currentAssistantIdRef.current
            ? { ...m, content: (m.content || "") + chunk }
            : m
        )
      );
    }, 3);
  };

  const stopTypingInterval = () => {
    if (typingTimerRef.current !== null) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    currentAssistantIdRef.current = null;
    typingBufferRef.current = "";
  };

  // Helper to create or fetch a session on demand
  const getOrCreateSession = async (): Promise<string | null> => {
    try {
      if (sessionId) return sessionId;
      const listRes = await fetch(
        API_CONFIG.endpoints.listChatSessions(contractId)
      );
      if (listRes.ok) {
        const data = await listRes.json();
        const existing = data.sessions?.[0]?.id as string | undefined;
        if (existing) {
          setSessionId(existing);
          return existing;
        }
      }
      const res = await fetch(API_CONFIG.endpoints.createChatSession, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        return data.sessionId as string;
      }
      return null;
    } catch (e) {
      console.error("Failed to get/create chat session", e);
      return null;
    }
  };

  // Check context availability
  const checkContext = async () => {
    if (!solicitationId) {
      setCtxReady(true);
      return;
    }
    try {
      const r = await fetch(
        API_CONFIG.endpoints.solicitationStatus(solicitationId)
      );
      if (r.ok) {
        const data = await r.json();
        setCtxReady((data.count || 0) > 0);
      } else {
        setCtxReady(true);
      }
    } catch {
      setCtxReady(true);
    }
  };

  useEffect(() => {
    // Initialize session and load history
    (async () => {
      const sid = await getOrCreateSession();
      if (sid) {
        try {
          const res = await fetch(API_CONFIG.endpoints.getChatMessages(sid));
          if (res.ok) {
            const data = await res.json();
            const mapped = (data.messages || []).map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
              meta: {
                model: m.model || m?.meta?.model,
                durationMs: m.durationMs ?? m?.meta?.durationMs,
                tokensPerSec: undefined,
                feedback: m.feedback ?? m?.meta?.feedback,
              },
            }));
            setMessages(mapped);
          }
        } catch (e) {
          console.error("Failed to fetch messages", e);
        }
      }
      await checkContext();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, solicitationId]);

  useEffect(() => {
    try {
      localStorage.setItem("chatModelChoice", model);
    } catch {}
  }, [model]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, phase]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopTypingInterval();
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopTypingInterval();
    setLoading(false);
    setPhase("idle");
  };

  const handlePrepare = async () => {
    if (!solicitationId) return;
    try {
      setCtxBusy(true);
      const r = await fetch(
        API_CONFIG.endpoints.solicitationIngest(solicitationId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contractId }),
        }
      );
      if (!r.ok) throw new Error(`Ingest failed ${r.status}`);
      await checkContext();
    } catch (e) {
      console.error("Prepare chat failed", e);
    } finally {
      setCtxBusy(false);
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const candidate = overrideText ?? input;
    if (!candidate.trim() || loading) return;

    // Auto-prepare context if requested but not ready
    if (solicitationId && !ctxReady && !ctxBusy) {
      try {
        await handlePrepare();
        await checkContext();
      } catch {}
      if (!ctxReady) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: "system",
            content:
              "Chat context is not prepared yet. Click ‘Prepare Chat’ to cache solicitation documents, then try again.",
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
    }

    const ensuredSessionId = await getOrCreateSession();
    if (!ensuredSessionId) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "system",
          content: "Unable to start chat session. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    const text = candidate.trim();
    if (!overrideText) setInput("");
    setLoading(true);

    // Add user message
    const userId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: userId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Insert placeholder assistant message
    const placeholderId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: placeholderId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        meta: { model: model === "fast" ? "2.0-flash" : "2.5-pro" },
      },
    ]);

    try {
      setPhase("queued");
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(
        API_CONFIG.endpoints.streamChat(ensuredSessionId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractId,
            message: text,
            model: model === "fast" ? "2.0-flash" : "2.5-pro",
            solicitationId: solicitationId || undefined,
          }),
          signal: controller.signal,
        }
      );
      if (!res.ok || !res.body) throw new Error(`Stream error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let partial = "";

      // Prepare typing effect target
      currentAssistantIdRef.current = placeholderId;
      typingBufferRef.current = "";
      tokenCountRef.current = 0;
      respondingStartRef.current = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        partial += decoder.decode(value, { stream: true });

        const lines = partial.split("\n");
        partial = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "status") {
              if (evt.phase === "thinking") setPhase("thinking");
              else if (evt.phase === "responding") {
                setPhase("responding");
                respondingStartRef.current = Date.now();
                startTypingInterval(placeholderId);
              } else if (evt.phase === "queued") setPhase("queued");
            } else if (evt.type === "token") {
              typingBufferRef.current += String(evt.data);
              tokenCountRef.current += 1;
              startTypingInterval(placeholderId);
            } else if (evt.type === "done") {
              setPhase("idle");
              // compute metrics
              const end = Date.now();
              const start = respondingStartRef.current || end;
              const dur = Math.max(1, end - start);
              const tps = tokenCountRef.current / (dur / 1000);
              const rounded = Math.round(tps * 10) / 10;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === placeholderId
                    ? {
                        ...m,
                        meta: {
                          ...(m.meta || {}),
                          durationMs: dur,
                          tokensPerSec: rounded,
                        },
                      }
                    : m
                )
              );
            } else if (evt.type === "error") {
              setPhase("idle");
              setMessages((prev) => [
                ...prev,
                {
                  id: `err-${Date.now()}`,
                  role: "system",
                  content: evt.error || "Chat error",
                  createdAt: new Date().toISOString(),
                },
              ]);
            }
          } catch (err) {
            console.error("Bad stream line", line, err);
          }
        }
      }
    } catch (e) {
      if ((e as any)?.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "system",
            content: "Failed to stream response.",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      setPhase("idle");
      abortRef.current = null;
      if (typingBufferRef.current && currentAssistantIdRef.current) {
        const remaining = typingBufferRef.current;
        typingBufferRef.current = "";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === currentAssistantIdRef.current
              ? { ...m, content: (m.content || "") + remaining }
              : m
          )
        );
      }
      stopTypingInterval();
      // Refresh history to persist final content
      try {
        const sid = sessionId || (await getOrCreateSession());
        if (sid) {
          const r = await fetch(API_CONFIG.endpoints.getChatMessages(sid));
          if (r.ok) {
            const data = await r.json();
            const mapped = (data.messages || []).map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
              meta: {
                model: m.model || m?.meta?.model,
                durationMs: m.durationMs ?? m?.meta?.durationMs,
                tokensPerSec: undefined,
                feedback: m.feedback ?? m?.meta?.feedback,
              },
            }));
            setMessages(mapped);
          }
        }
      } catch {}
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset textarea height when becoming visible
  useEffect(() => {
    if (isVisible && textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      // Force a small delay to let the layout settle
      setTimeout(() => {
        const el = textAreaRef.current;
        if (el) {
          el.style.height = "auto";
          const max = Math.max(window.innerHeight * 0.4, 200);
          el.style.height =
            Math.min(el.scrollHeight + 16, max).toString() + "px";
        }
      }, 10);
    }
  }, [isVisible]);

  useEffect(() => {
    const el = textAreaRef.current;
    if (!el || !isVisible) return;

    // Only resize if the element is visible and has dimensions
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    el.style.height = "auto";
    // Grow up to ~40vh then scroll
    const max = Math.max(window.innerHeight * 0.4, 200);
    // Add extra padding space for the instruction line (~16px)
    el.style.height = Math.min(el.scrollHeight + 16, max).toString() + "px";
  }, [input, isVisible]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const isToday =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      const time = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (isToday) return `Today ${time}`;
      const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${date} ${time}`;
    } catch {
      return "";
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch {}
  };

  const setFeedback = async (messageId: string, value: 1 | -1 | 0) => {
    try {
      const current =
        messages.find((m) => m.id === messageId)?.meta?.feedback || 0;
      const next = current === value ? 0 : value;
      await fetch(API_CONFIG.endpoints.chatFeedback(messageId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, meta: { ...(m.meta || {}), feedback: next } as any }
            : m
        )
      );
      if (next !== 0) {
        setFeedbackPulse({ id: messageId, type: next === 1 ? "up" : "down" });
        window.setTimeout(() => setFeedbackPulse(null), 350);
      }
    } catch (e) {
      console.error("Failed to set feedback", e);
    }
  };

  // regenerate disabled

  const quickPrompts = [
    "Summarize the key requirements in plain English",
    "What are the gotchas in here?",
    "Write an email draft to the POC about my bid",
  ];

  const sendQuick = async (text: string) => {
    if (loading) return;
    await sendMessage(text);
  };

  const ModelPill: React.FC<{ model?: string }> = ({ model }) => {
    if (!model) return null;
    if (model.includes("2.0")) {
      return (
        <span className="inline-flex items-center gap-1 cursor-default">
          <Zap className="w-3.5 h-3.5 text-blue-400" />
          <span>Faster</span>
        </span>
      );
    }
    if (model.includes("2.5")) {
      return (
        <span className="inline-flex items-center gap-1 cursor-default">
          <Brain className="w-3.5 h-3.5 text-purple-300" />
          <span>Smarter</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 cursor-default">
        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
        <span>Model</span>
      </span>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-blue-600/15 via-purple-600/15 to-cyan-500/15">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-gradient-to-br from-blue-600/25 to-purple-600/25 text-blue-700 dark:text-blue-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">AI Chat</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">
                {phase === "thinking"
                  ? "Thinking…"
                  : phase === "responding"
                  ? "Responding…"
                  : "Ask questions about this contract"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setShowModelCard((s) => !s)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs hover:bg-muted/70"
              title="Select model"
            >
              {model === "fast" ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <span>Faster · 0.25</span>
                </>
              ) : (
                <>
                  <Brain className="w-3.5 h-3.5 text-purple-300" />
                  <span>Smarter · 1</span>
                </>
              )}
            </button>
            {showModelCard && (
              <div className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-border bg-card shadow-xl">
                <div className="p-2">
                  <button
                    onClick={() => {
                      setModel("fast");
                      setShowModelCard(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted ${
                      model === "fast" ? "ring-2 ring-blue-500/40" : ""
                    }`}
                  >
                    <div className="shrink-0 rounded-md bg-blue-500/15 p-1.5">
                      <Zap className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Faster</div>
                      <div className="text-[11px] text-muted-foreground">
                        0.25 chat credits
                      </div>
                    </div>
                    <span className="text-[10px] rounded-full bg-blue-500/15 text-blue-300 px-2 py-0.5">
                      quick
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setModel("smart");
                      setShowModelCard(false);
                    }}
                    className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted ${
                      model === "smart" ? "ring-2 ring-purple-500/40" : ""
                    }`}
                  >
                    <div className="shrink-0 rounded-md bg-purple-500/15 p-1.5">
                      <Brain className="w-4 h-4 text-purple-300" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Smarter</div>
                      <div className="text-[11px] text-muted-foreground">
                        1 chat credit
                      </div>
                    </div>
                    <span className="text-[10px] rounded-full bg-purple-500/15 text-purple-200 px-2 py-0.5">
                      quality
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages wrapper with subtle radial background */}
      <div className="relative flex-1 min-h-0">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_240px_at_80%_-10%,rgba(59,130,246,0.10),transparent_60%)]" />
        <div
          ref={scrollRef}
          className="relative h-full overflow-y-auto p-4 space-y-3"
        >
          {!ctxReady && (
            <div className="h-full min-h-[200px] flex items-center justify-center">
              <button
                onClick={handlePrepare}
                disabled={ctxBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-blue-500/10 px-4 py-2 text-sm text-blue-200 hover:bg-blue-500/20 disabled:opacity-50"
                title="Prepare chat context"
              >
                <FileText className="w-4 h-4" />{" "}
                {ctxBusy ? "Preparing…" : "Prepare Chat"}
              </button>
            </div>
          )}

          {messages.length === 0 && !loading && ctxReady && (
            <div className="h-full flex flex-col justify-end pb-4">
              <div className="text-sm text-muted-foreground mb-2 px-1">
                Try one of these to get started
              </div>
              <div className="flex flex-col gap-2">
                {quickPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      void sendQuick(q);
                    }}
                    className="text-left group rounded-lg border border-border/30 bg-[linear-gradient(90deg,#2563EB,#7C3AED,#06B6D4)] text-white hover:brightness-110 transition shadow-sm px-3 py-2"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-white/70 mb-0.5">
                      Example
                    </div>
                    <div className="text-sm leading-snug">{q}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {ctxReady &&
            messages.map((m) => {
              if (m.role === "assistant" && !m.content) return null;
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`group flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] md:max-w-[70%] whitespace-pre-wrap px-3 py-2 rounded-xl text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-[linear-gradient(180deg,rgba(59,130,246,.95),rgba(99,102,241,.95))] text-white"
                        : m.role === "assistant"
                        ? "bg-muted/70 border border-border text-foreground"
                        : "bg-amber-50 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {DOMPurify.sanitize(m.content)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                  {m.role !== "system" && (
                    <div className="mt-1 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                      <div
                        className={`inline-flex items-center gap-3 text-[10px] ${
                          isUser ? "text-white/80" : "text-muted-foreground"
                        }`}
                      >
                        <span className="cursor-default inline-flex items-center gap-1">
                          <ModelPill model={m.meta?.model || undefined} />
                        </span>
                        <span className="cursor-default">
                          {formatTime(m.createdAt)}
                        </span>
                        {!isUser && (
                          <>
                            <button
                              onClick={() => setFeedback(m.id, 1)}
                              className={`relative pointer-events-auto inline-flex items-center justify-center rounded transition h-5 w-5 cursor-pointer ${
                                m.meta?.feedback === 1
                                  ? "text-green-400"
                                  : "hover:bg-black/10"
                              }`}
                              title="Helpful"
                            >
                              {feedbackPulse?.id === m.id &&
                                feedbackPulse?.type === "up" && (
                                  <span className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
                                )}
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setFeedback(m.id, -1)}
                              className={`relative pointer-events-auto inline-flex items-center justify-center rounded transition h-5 w-5 cursor-pointer ${
                                m.meta?.feedback === -1
                                  ? "text-red-400"
                                  : "hover:bg-black/10"
                              }`}
                              title="Not helpful"
                            >
                              {feedbackPulse?.id === m.id &&
                                feedbackPulse?.type === "down" && (
                                  <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                                )}
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleCopy(m.id, m.content)}
                          className="pointer-events-auto ml-1 inline-flex items-center justify-center rounded hover:bg-black/10 transition h-5 w-5 cursor-pointer"
                          title={copiedId === m.id ? "Copied" : "Copy"}
                        >
                          {copiedId === m.id ? (
                            <CheckIcon className="w-3.5 h-3.5" />
                          ) : (
                            <CopyIcon className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          {loading && (phase === "thinking" || phase === "queued") && (
            <div className="text-[11px] inline-flex items-center gap-2">
              <style>{`
                @keyframes phaseShimmer {
                  0% { background-position: 200% 0; }
                  100% { background-position: -200% 0; }
                }
              `}</style>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
              <span
                className="relative inline-block bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #ffffff, #5E5E5E, #ffffff)",
                  backgroundSize: "200% 100%",
                  animation: "phaseShimmer 3s linear infinite",
                  WebkitBackgroundClip: "text",
                }}
              >
                {thinkingPhrases[thinkingIdx]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <div className="group relative w-full rounded-xl border border-border bg-background/70 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500/40 transition">
              <textarea
                ref={textAreaRef}
                className="w-full resize-none bg-transparent px-3 pr-12 py-2 pb-6 text-sm outline-none"
                placeholder="Ask anything..."
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className="pointer-events-none absolute inset-x-3 bottom-1.5 text-[10px] text-muted-foreground/70">
                Press Enter to send • Shift+Enter for new line
              </div>
              {/* Inline circular send button */}
              {(() => {
                const isProcessing = loading;
                return (
                  <button
                    onClick={() => {
                      if (isProcessing) {
                        stopStreaming();
                      } else {
                        void sendMessage();
                      }
                    }}
                    disabled={!input.trim() && !isProcessing}
                    className={`absolute right-2 bottom-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm focus:outline-none focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                      isProcessing
                        ? "bg-gradient-to-r from-red-600 to-rose-600 focus:ring-red-500/40"
                        : "bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-600 hover:to-purple-600 focus:ring-blue-500/40"
                    }`}
                    title={isProcessing ? "Stop" : "Send message"}
                  >
                    <div className="relative h-4 w-4">
                      <ArrowUp
                        className={`absolute inset-0 m-auto h-4 w-4 drop-shadow transition-opacity duration-200 ${
                          isProcessing ? "opacity-0" : "opacity-100"
                        }`}
                      />
                      <Square
                        className={`absolute inset-0 m-auto h-4 w-4 transition-opacity duration-200 ${
                          isProcessing ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </div>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
