"use client";

import { useState, useRef, useEffect, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Bot, Send, RotateCcw, BookOpen, Zap, X, Sparkles, Lightbulb,
  Plus, Clock, MessageSquare, PanelLeftClose, PanelLeftOpen, History,
} from "lucide-react";
import { useSessionStore } from "@/store/session";
import { useAuthStore } from "@/store/auth";
import { AI_MESSAGE_LIMITS } from "@/lib/constants";
import type { TutorContext } from "@/types";
import ReactMarkdown from "react-markdown";

type TutorMode = "socratic" | "direct";

interface SavedConversation {
  id: string;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  mode: TutorMode;
  savedAt: string;
}

const HISTORY_KEY = "arcus-tutor-history";
const MAX_HISTORY = 20;

function loadHistory(): SavedConversation[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(history: SavedConversation[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch { /* storage full */ }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Context panel ───────────────────────────────────────────────────────────

function ContextPanel({ ctx, onDismiss }: { ctx: TutorContext; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "#13131A",
        border: "1px solid rgba(0,201,124,0.2)",
        borderRadius: 10,
        padding: "14px 18px",
        marginBottom: 12,
        position: "relative",
      }}
    >
      <button
        onClick={onDismiss}
        style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: "#52526B", padding: 4, display: "flex" }}
      >
        <X size={13} />
      </button>
      <p style={{ fontSize: 11, letterSpacing: "0.06em", color: "#52526B", textTransform: "uppercase", margin: "0 0 6px" }}>
        Question Context{ctx.domainName ? ` · ${ctx.domainName}` : ""}
      </p>
      {ctx.questionContent && (
        <p style={{ fontSize: 13, color: "#F1F1F5", margin: "0 0 8px", lineHeight: 1.5 }}>
          {ctx.questionContent}
        </p>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {ctx.userAnswer && ctx.userAnswer.length > 0 && (
          <span style={{ fontSize: 12, color: "#EF4444" }}>Your answer: {ctx.userAnswer.join(", ")}</span>
        )}
        {ctx.correctAnswer && ctx.correctAnswer.length > 0 && (
          <span style={{ fontSize: 12, color: "#4ADE80" }}>Correct: {ctx.correctAnswer.join(", ")}</span>
        )}
        {ctx.masteryPercent !== undefined && (
          <span style={{ fontSize: 12, color: "#00C97C" }}>Mastery: {ctx.masteryPercent}%</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Rate limit bar ──────────────────────────────────────────────────────────

function RateLimitBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#00C97C";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: "#2A2A38", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 11, color: "#52526B", whiteSpace: "nowrap" }}>{used}/{limit} msgs</span>
    </div>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({ role, text }: { role: string; text: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(0,201,124,0.1)", border: "1px solid rgba(0,201,124,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, marginRight: 10, marginTop: 2,
        }}>
          <Bot size={14} style={{ color: "#00C97C" }} />
        </div>
      )}
      <div style={{
        maxWidth: "78%",
        background: isUser ? "rgba(0,201,124,0.10)" : "#13131A",
        border: `1px solid ${isUser ? "rgba(0,201,124,0.25)" : "#2A2A38"}`,
        borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
        padding: "12px 16px", fontSize: 14, color: "#F1F1F5", lineHeight: 1.65,
      }} className="tutor-message">
        {isUser ? <span>{text}</span> : <ReactMarkdown>{text}</ReactMarkdown>}
      </div>
    </div>
  );
}

// ── Tool result card ────────────────────────────────────────────────────────

function ToolResultCard({ toolName, result }: { toolName: string; result: unknown }) {
  const r = result as Record<string, unknown>;
  const labels: Record<string, string> = {
    generatePracticeQuestion: "📝 Practice Question",
    lookupDocumentation: "📚 AWS Docs",
    checkUserProgress: "📊 Your Progress",
    createFlashcard: "🗂 Flashcard Saved",
  };
  return (
    <div style={{
      background: "#1C1C26", border: "1px solid #2A2A38", borderRadius: 8,
      padding: "10px 14px", marginBottom: 10, marginLeft: 38, fontSize: 13,
    }}>
      <p style={{ fontSize: 11, color: "#52526B", margin: "0 0 4px", fontWeight: 600 }}>
        {labels[toolName] ?? toolName}
      </p>
      {toolName === "lookupDocumentation" && Boolean(r.url) && (
        <a href={String(r.url)} target="_blank" rel="noopener noreferrer" style={{ color: "#00C97C", fontSize: 13 }}>
          {String(r.service)} documentation →
        </a>
      )}
      {toolName === "createFlashcard" && Boolean(r.success) && (
        <p style={{ color: "#4ADE80", margin: 0 }}>Saved: &ldquo;{String(r.front)}&rdquo;</p>
      )}
      {toolName === "checkUserProgress" && (
        <p style={{ color: "#8B8BA7", margin: 0 }}>
          {String(r.domainName)}: {String(r.mastery)}% mastery · {String(r.questionsAnswered)}q answered
        </p>
      )}
      {toolName === "generatePracticeQuestion" && Boolean(r.question) && (
        <p style={{ color: "#F1F1F5", margin: 0 }}>{String(r.question)}</p>
      )}
    </div>
  );
}

// ── History sidebar ─────────────────────────────────────────────────────────

function HistorySidebar({
  history,
  activeId,
  collapsed,
  mobileOpen,
  onToggle,
  onMobileClose,
  onSelect,
  onNew,
  onDelete,
}: {
  history: SavedConversation[];
  activeId: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  onSelect: (conv: SavedConversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  // Shared inner content (used by both desktop sidebar and mobile drawer)
  const innerContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, height: "100%" }}>
      <button
        onClick={onNew}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "#13131A", border: "1px solid #2A2A38",
          borderRadius: 7, padding: "8px 12px", cursor: "pointer",
          color: "#F1F1F5", fontSize: 13, fontFamily: "inherit",
          flexShrink: 0, transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D3D52")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A38")}
      >
        <Plus size={13} style={{ color: "#00C97C" }} />
        New chat
      </button>

      <p style={{ fontSize: 11, color: "#52526B", margin: "4px 0 2px", letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
        History
      </p>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {history.length === 0 && (
          <p style={{ fontSize: 12, color: "#3D3D52", margin: "8px 0", lineHeight: 1.5 }}>
            Your conversations will appear here.
          </p>
        )}
        {history.map((conv) => (
          <div
            key={conv.id}
            style={{
              position: "relative", borderRadius: 6,
              background: conv.id === activeId ? "rgba(0,201,124,0.08)" : "transparent",
              border: `1px solid ${conv.id === activeId ? "rgba(0,201,124,0.2)" : "transparent"}`,
            }}
            className="history-item"
          >
            <button
              onClick={() => { onSelect(conv); onMobileClose(); }}
              style={{
                width: "100%", background: "none", border: "none",
                cursor: "pointer", textAlign: "left", padding: "7px 28px 7px 8px",
                fontFamily: "inherit",
              }}
            >
              <p style={{
                fontSize: 12, color: conv.id === activeId ? "#F1F1F5" : "#8B8BA7",
                margin: 0, overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", lineHeight: 1.4,
              }}>
                {conv.title}
              </p>
              <p style={{ fontSize: 10, color: "#52526B", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 3 }}>
                <Clock size={9} />{relativeTime(conv.savedAt)}
              </p>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              className="history-delete"
              style={{
                position: "absolute", top: 6, right: 4,
                background: "none", border: "none", cursor: "pointer",
                color: "#52526B", padding: 3, display: "flex",
                opacity: 0, transition: "opacity 0.15s",
              }}
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile via CSS) ─────────────────── */}
      <div className="tutor-sidebar-desktop" style={{
        width: collapsed ? 36 : 200,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: collapsed ? 8 : 4,
        borderRight: "1px solid #2A2A38",
        paddingRight: collapsed ? 0 : 16,
        marginRight: collapsed ? 12 : 16,
        transition: "width 0.2s ease, padding-right 0.2s ease",
        overflow: "hidden",
      }}>
        {/* Toggle button */}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand history" : "Collapse history"}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: 6, flexShrink: 0,
            background: "transparent", border: "1px solid #2A2A38",
            cursor: "pointer", color: "#52526B", transition: "border-color 0.15s, color 0.15s",
            alignSelf: collapsed ? "center" : "flex-start",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3D3D52"; e.currentTarget.style.color = "#F1F1F5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2A2A38"; e.currentTarget.style.color = "#52526B"; }}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        {!collapsed && innerContent}
      </div>

      {/* ── Mobile drawer overlay (hidden on desktop via CSS) ──────────── */}
      {mobileOpen && (
        <div className="tutor-sidebar-mobile-overlay" onClick={onMobileClose} style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.5)",
        }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, left: 0, bottom: 0,
              width: 260, background: "#0D0D14",
              borderRight: "1px solid #2A2A38",
              padding: "16px 16px 24px",
              display: "flex", flexDirection: "column", gap: 0,
            }}
          >
            {/* Mobile drawer header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>Chat History</p>
              <button
                onClick={onMobileClose}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#52526B", padding: 4, display: "flex" }}
              >
                <X size={16} />
              </button>
            </div>
            {innerContent}
          </div>
        </div>
      )}
    </>
  );
}

// ── Main content ────────────────────────────────────────────────────────────

function TutorContent() {
  const searchParams = useSearchParams();
  const questionIdParam = searchParams.get("questionId");

  const { profile } = useAuthStore();
  const { tutorContext, setTutorContext } = useSessionStore();

  const [mode, setMode] = useState<TutorMode>("socratic");
  const [inputText, setInputText] = useState("");
  const [showContext, setShowContext] = useState(true);
  const [dailyUsed, setDailyUsed] = useState(profile?.daily_ai_messages_used ?? 0);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const tier = profile?.subscription_tier ?? "free";
  const dailyLimit = AI_MESSAGE_LIMITS[tier as keyof typeof AI_MESSAGE_LIMITS] ?? AI_MESSAGE_LIMITS.free;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Live refs so the transport function can read current values without remounting
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const activeContext: TutorContext | null = tutorContext ?? (questionIdParam ? { questionId: questionIdParam } : null);
  const contextRef = useRef(activeContext);
  contextRef.current = activeContext;

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Create transport once
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/tutor",
        body: () => ({ mode: modeRef.current, context: contextRef.current }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    onError: (err: Error) => {
      const msg = err.message ?? "";
      if (msg.includes("rate_limited")) {
        setRateLimitError(`Daily limit of ${dailyLimit} messages reached.`);
      } else if (msg.includes("circuit_breaker")) {
        setRateLimitError("High usage detected — try again in a few minutes.");
      } else {
        setRateLimitError(null);
      }
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-save conversation to history whenever messages change (debounced)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? (getMessageText(firstUserMsg as { parts?: Array<{ type: string; text?: string }> }).slice(0, 50) || "New conversation")
        : "New conversation";

      const convId = activeConvId ?? `conv-${Date.now()}`;
      if (!activeConvId) setActiveConvId(convId);

      setHistory((prev) => {
        const without = prev.filter((c) => c.id !== convId);
        const updated: SavedConversation = {
          id: convId,
          title,
          messages,
          mode,
          savedAt: new Date().toISOString(),
        };
        const next = [updated, ...without];
        saveHistory(next);
        return next;
      });
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Auto-send opening message when context is set
  const hasSentOpening = useRef(false);
  useEffect(() => {
    if (activeContext?.questionContent && messages.length === 0 && !hasSentOpening.current) {
      hasSentOpening.current = true;
      const text =
        mode === "socratic"
          ? `I got this question wrong. Help me understand it: "${activeContext.questionContent}"`
          : `Please explain this question I got wrong: "${activeContext.questionContent}"`;
      sendMessage({ text });
      setDailyUsed((n) => n + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContext?.questionContent]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    if (dailyUsed >= dailyLimit) {
      setRateLimitError(`Daily limit of ${dailyLimit} messages reached.`);
      return;
    }
    setRateLimitError(null);
    setInputText("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setDailyUsed((n) => n + 1);
    sendMessage({ text });
  }, [inputText, isStreaming, dailyUsed, dailyLimit, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNew = useCallback(() => {
    setMessages([]);
    setActiveConvId(null);
    hasSentOpening.current = false;
    setRateLimitError(null);
    setInputText("");
    textareaRef.current?.focus();
  }, [setMessages]);

  const handleSelectConv = useCallback((conv: SavedConversation) => {
    setMessages(conv.messages);
    setActiveConvId(conv.id);
    setMode(conv.mode);
    setRateLimitError(null);
    hasSentOpening.current = true; // prevent re-firing auto-send
  }, [setMessages]);

  const handleDeleteConv = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveHistory(next);
      return next;
    });
    if (activeConvId === id) {
      setMessages([]);
      setActiveConvId(null);
    }
  }, [activeConvId, setMessages]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setActiveConvId(null);
    hasSentOpening.current = false;
    setRateLimitError(null);
  }, [setMessages]);

  const handleDismissContext = () => {
    setShowContext(false);
    setTutorContext(null);
  };

  // Extract text from message parts (AI SDK v6 uses parts, not .content)
  const getMessageText = (msg: { parts?: Array<{ type: string; text?: string }> }): string =>
    (msg.parts ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");

  const getToolParts = (msg: { parts?: Array<{ type: string; toolInvocation?: { toolName: string; state: string; result?: unknown } }> }) =>
    (msg.parts ?? []).filter((p) => p.type === "tool-invocation");

  return (
    <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", height: "calc(100vh - 72px)" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14, flexShrink: 0, flexWrap: "wrap", gap: 8,
        paddingBottom: 14, borderBottom: "1px solid #2A2A38",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: "rgba(0,201,124,0.1)", border: "1px solid rgba(0,201,124,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={16} style={{ color: "#00C97C" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 600, color: "#F1F1F5", margin: 0, lineHeight: 1.3 }}>AI Tutor</h1>
            <p style={{ fontSize: 11, color: "#52526B", margin: 0 }}>AWS Solutions Architect</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Mobile-only: open history drawer */}
          <button
            onClick={() => setMobileHistoryOpen(true)}
            title="Chat history"
            className="tutor-history-mobile-btn"
            style={{
              background: "none", border: "1px solid #2A2A38", borderRadius: 6,
              padding: "5px 8px", cursor: "pointer", color: "#8B8BA7",
              display: "none", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D3D52")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A38")}
          >
            <History size={13} />
          </button>

          <button
            onClick={handleReset}
            title="Clear conversation"
            style={{
              background: "none", border: "1px solid #2A2A38", borderRadius: 6,
              padding: "5px 10px", cursor: "pointer", color: "#8B8BA7",
              display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D3D52")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A38")}
          >
            <RotateCcw size={11} /> Reset
          </button>

          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#13131A", border: "1px solid #2A2A38", borderRadius: 6, overflow: "hidden" }}>
            {(["socratic", "direct"] as TutorMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={m === "socratic" ? "Guides you to the answer through questions" : "Clear explanations, straight to the point"}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
                  fontSize: 12, fontWeight: mode === m ? 600 : 400,
                  color: mode === m ? "#00C97C" : "#8B8BA7",
                  background: mode === m ? "rgba(0,201,124,0.08)" : "transparent",
                  border: "none", cursor: "pointer", transition: "color 0.15s, background 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {m === "socratic" ? <Lightbulb size={12} /> : <Zap size={12} />}
                {m === "socratic" ? "Socratic" : "Direct"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body: history sidebar + chat */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

        {/* History sidebar */}
        <HistorySidebar
          history={history}
          activeId={activeConvId}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileHistoryOpen}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          onMobileClose={() => setMobileHistoryOpen(false)}
          onSelect={handleSelectConv}
          onNew={handleNew}
          onDelete={handleDeleteConv}
        />

        {/* Chat column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Context panel */}
          {activeContext && showContext && (
            <ContextPanel ctx={activeContext} onDismiss={handleDismissContext} />
          )}
          {activeContext && !showContext && (
            <button
              onClick={() => setShowContext(true)}
              style={{ fontSize: 12, color: "#52526B", background: "none", border: "none", cursor: "pointer", marginBottom: 10, padding: 0, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}
            >
              <BookOpen size={12} /> Show question context
            </button>
          )}

          {/* Rate limit bar */}
          <div style={{ marginBottom: 10, flexShrink: 0 }}>
            <RateLimitBar used={dailyUsed} limit={dailyLimit} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 2px", marginBottom: 10 }}>
            {messages.length === 0 && !isStreaming && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, color: "#52526B" }}>
                <MessageSquare size={36} style={{ opacity: 0.25 }} />
                <p style={{ fontSize: 14, margin: 0, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
                  {activeContext ? "Starting with your question context…" : "Ask me anything about AWS architecture or exam topics."}
                </p>
                {!activeContext && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                    {["Explain S3 storage classes", "SQS vs SNS?", "RDS Multi-AZ vs Read Replica"].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => { setInputText(prompt); textareaRef.current?.focus(); }}
                        style={{ fontSize: 12, color: "#8B8BA7", background: "#13131A", border: "1px solid #2A2A38", borderRadius: 20, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D3D52")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A38")}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const text = getMessageText(msg as { parts?: Array<{ type: string; text?: string }> });
                const toolParts = getToolParts(msg as { parts?: Array<{ type: string; toolInvocation?: { toolName: string; state: string; result?: unknown } }> });
                return (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    {text && <MessageBubble role={msg.role} text={text} />}
                    {toolParts.map((part, idx) => {
                      const tp = part as { type: string; toolInvocation?: { toolName: string; state: string; result?: unknown } };
                      if (tp.toolInvocation?.state === "result" && tp.toolInvocation.result) {
                        return <ToolResultCard key={idx} toolName={tp.toolInvocation.toolName} result={tp.toolInvocation.result} />;
                      }
                      return null;
                    })}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Streaming indicator */}
            {isStreaming && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(0,201,124,0.1)", border: "1px solid rgba(0,201,124,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Bot size={14} style={{ color: "#00C97C" }} />
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      style={{ width: 5, height: 5, borderRadius: "50%", background: "#00C97C" }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {(error || rateLimitError) && (
              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 10,
              }}>
                <p style={{ fontSize: 13, color: "#EF4444", margin: 0 }}>
                  {rateLimitError ?? "Something went wrong. Please try again."}
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ flexShrink: 0 }}>
            <div
              className="tutor-input-wrap"
              style={{
                background: "#13131A", border: "1px solid #2A2A38", borderRadius: 12,
                padding: "10px 10px 10px 14px",
                display: "flex", alignItems: "flex-end", gap: 8,
                transition: "border-color 0.15s",
              }}
            >
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={dailyUsed >= dailyLimit ? "Daily message limit reached" : "Ask about AWS concepts, services, or exam strategies…"}
                disabled={dailyUsed >= dailyLimit || isStreaming}
                rows={1}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  resize: "none", fontSize: 14, color: "#F1F1F5",
                  fontFamily: "var(--font-geist-sans)", lineHeight: 1.5,
                  maxHeight: 140, overflowY: "auto", paddingTop: 2,
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = `${Math.min(t.scrollHeight, 140)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isStreaming || dailyUsed >= dailyLimit}
                style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: inputText.trim() && !isStreaming ? "#00C97C" : "#1C1C26",
                  border: "none", cursor: inputText.trim() && !isStreaming ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { if (inputText.trim() && !isStreaming) e.currentTarget.style.background = "#00B06C"; }}
                onMouseLeave={(e) => { if (inputText.trim() && !isStreaming) e.currentTarget.style.background = "#00C97C"; }}
              >
                <Send size={14} style={{ color: inputText.trim() && !isStreaming ? "#fff" : "#52526B" }} />
              </button>
            </div>

            <p style={{ fontSize: 11, color: "#3D3D52", textAlign: "center", marginTop: 7 }}>
              {mode === "socratic" ? "Socratic — guided discovery" : "Direct — clear explanations"}
              {" · "}
              <kbd style={{ background: "#1C1C26", border: "1px solid #2A2A38", borderRadius: 3, padding: "1px 4px", fontSize: 10 }}>Enter</kbd>
              {" to send, "}
              <kbd style={{ background: "#1C1C26", border: "1px solid #2A2A38", borderRadius: 3, padding: "1px 4px", fontSize: 10 }}>Shift+Enter</kbd>
              {" for newline"}
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .tutor-message p { margin: 0 0 8px; }
        .tutor-message p:last-child { margin-bottom: 0; }
        .tutor-message ul, .tutor-message ol { margin: 4px 0 8px; padding-left: 18px; }
        .tutor-message li { margin-bottom: 4px; }
        .tutor-message code { background: #1C1C26; border: 1px solid #2A2A38; border-radius: 3px; padding: 1px 5px; font-size: 12px; font-family: var(--font-geist-mono); }
        .tutor-message pre { background: #1C1C26; border: 1px solid #2A2A38; border-radius: 6px; padding: 12px; overflow-x: auto; margin: 8px 0; }
        .tutor-message pre code { background: none; border: none; padding: 0; }
        .tutor-input-wrap:focus-within { border-color: #3D3D52 !important; }
        .history-item:hover .history-delete { opacity: 1 !important; }
        /* Desktop: sidebar visible, mobile btn hidden */
        .tutor-sidebar-desktop { display: flex !important; }
        .tutor-history-mobile-btn { display: none !important; }
        @media (max-width: 768px) {
          /* Hide desktop sidebar column on mobile — use drawer instead */
          .tutor-sidebar-desktop { display: none !important; }
          /* Show mobile history button in header */
          .tutor-history-mobile-btn { display: flex !important; }
          /* Slightly smaller font in textarea to avoid iOS zoom */
          .tutor-input-wrap textarea { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "32px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ height: 34, width: 160, background: "#13131A", borderRadius: 8 }} className="animate-pulse" />
        <div style={{ height: 460, background: "#13131A", borderRadius: 10, border: "1px solid #2A2A38" }} className="animate-pulse" />
      </div>
    }>
      <TutorContent />
    </Suspense>
  );
}
