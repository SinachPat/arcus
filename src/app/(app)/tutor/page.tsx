"use client";

import { useState, useRef, useEffect, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Send, RotateCcw, BookOpen, Zap, X, Sparkles, Lightbulb } from "lucide-react";
import { useSessionStore } from "@/store/session";
import { useAuthStore } from "@/store/auth";
import { AI_MESSAGE_LIMITS } from "@/lib/constants";
import type { TutorContext } from "@/types";
import ReactMarkdown from "react-markdown";

type TutorMode = "socratic" | "direct";

// ── Context panel ──────────────────────────────────────────────────────────

function ContextPanel({ ctx, onDismiss }: { ctx: TutorContext; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "#13131A",
        border: "1px solid rgba(0,201,124,0.2)",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 16,
        position: "relative",
      }}
    >
      <button
        onClick={onDismiss}
        style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", cursor: "pointer", color: "#52526B", padding: 4, display: "flex" }}
      >
        <X size={14} />
      </button>
      <p style={{ fontSize: 11, letterSpacing: "0.06em", color: "#52526B", textTransform: "uppercase", margin: "0 0 8px" }}>
        Question Context{ctx.domainName ? ` · ${ctx.domainName}` : ""}
      </p>
      {ctx.questionContent && (
        <p style={{ fontSize: 13, color: "#F1F1F5", margin: "0 0 10px", lineHeight: 1.5 }}>
          {ctx.questionContent}
        </p>
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {ctx.userAnswer && ctx.userAnswer.length > 0 && (
          <span style={{ fontSize: 12, color: "#EF4444" }}>Your answer: {ctx.userAnswer.join(", ")}</span>
        )}
        {ctx.correctAnswer && ctx.correctAnswer.length > 0 && (
          <span style={{ fontSize: 12, color: "#4ADE80" }}>Correct: {ctx.correctAnswer.join(", ")}</span>
        )}
        {ctx.masteryPercent !== undefined && (
          <span style={{ fontSize: 12, color: "#00C97C" }}>Domain mastery: {ctx.masteryPercent}%</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Rate limit bar ─────────────────────────────────────────────────────────

function RateLimitBar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "#EF4444" : pct >= 70 ? "#F59E0B" : "#00C97C";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "#2A2A38", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 11, color: "#52526B", whiteSpace: "nowrap" }}>{used}/{limit} msgs</span>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ role, text }: { role: string; text: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
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
        borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
        padding: "12px 16px", fontSize: 14, color: "#F1F1F5", lineHeight: 1.6,
      }} className="tutor-message">
        {isUser ? <span>{text}</span> : <ReactMarkdown>{text}</ReactMarkdown>}
      </div>
    </div>
  );
}

// ── Tool result card ───────────────────────────────────────────────────────

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
      padding: "12px 16px", marginBottom: 12, marginLeft: 38, fontSize: 13,
    }}>
      <p style={{ fontSize: 11, color: "#52526B", margin: "0 0 6px", fontWeight: 600 }}>
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

// ── Main content ───────────────────────────────────────────────────────────

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

  const tier = profile?.subscription_tier ?? "free";
  const dailyLimit = AI_MESSAGE_LIMITS[tier as keyof typeof AI_MESSAGE_LIMITS] ?? AI_MESSAGE_LIMITS.free;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Live refs so the transport function can read current values
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const activeContext: TutorContext | null = tutorContext ?? (questionIdParam ? { questionId: questionIdParam } : null);
  const contextRef = useRef(activeContext);
  contextRef.current = activeContext;

  // Create transport once — body is a function so it always reads the latest refs
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

  // Auto-send opening message when context is available and chat is empty
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
    setDailyUsed((n) => n + 1);
    sendMessage({ text });
  }, [inputText, isStreaming, dailyUsed, dailyLimit, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    hasSentOpening.current = false;
    setRateLimitError(null);
  };

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
    <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", maxHeight: 900 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(0,201,124,0.1)", border: "1px solid rgba(0,201,124,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={18} style={{ color: "#00C97C" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: "#F1F1F5", margin: 0 }}>AI Tutor</h1>
            <p style={{ fontSize: 12, color: "#52526B", margin: 0 }}>AWS Solutions Architect</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleReset}
            title="Clear conversation"
            style={{ background: "none", border: "1px solid #2A2A38", borderRadius: 6, padding: "6px 10px", cursor: "pointer", color: "#8B8BA7", display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontFamily: "inherit" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3D3D52")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A38")}
          >
            <RotateCcw size={12} /> Reset
          </button>

          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#13131A", border: "1px solid #2A2A38", borderRadius: 6, overflow: "hidden" }}>
            {(["socratic", "direct"] as TutorMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                title={m === "socratic" ? "Guides you to the answer through questions" : "Clear explanations, straight to the point"}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                  fontSize: 12, fontWeight: mode === m ? 600 : 400,
                  color: mode === m ? "#00C97C" : "#8B8BA7",
                  background: mode === m ? "rgba(0,201,124,0.08)" : "transparent",
                  border: "none", cursor: "pointer", transition: "color 0.15s, background 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {m === "socratic" ? <Lightbulb size={13} /> : <Zap size={13} />}
                {m === "socratic" ? "Socratic" : "Direct"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Context panel */}
      <div style={{ flexShrink: 0 }}>
        {activeContext && showContext && (
          <ContextPanel ctx={activeContext} onDismiss={handleDismissContext} />
        )}
        {activeContext && !showContext && (
          <button
            onClick={() => setShowContext(true)}
            style={{ fontSize: 12, color: "#52526B", background: "none", border: "none", cursor: "pointer", marginBottom: 12, padding: 0, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}
          >
            <BookOpen size={12} /> Show question context
          </button>
        )}
      </div>

      {/* Rate limit bar */}
      <div style={{ marginBottom: 12, flexShrink: 0 }}>
        <RateLimitBar used={dailyUsed} limit={dailyLimit} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0", marginBottom: 12 }}>
        {messages.length === 0 && !isStreaming && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "#52526B" }}>
            <Bot size={40} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 14, margin: 0, textAlign: "center" }}>
              {activeContext ? "Starting with your question context…" : "Ask me anything about AWS architecture or exam topics."}
            </p>
            {!activeContext && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                {["Explain S3 storage classes", "When to use SQS vs SNS?", "RDS Multi-AZ vs Read Replica"].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInputText(prompt); textareaRef.current?.focus(); }}
                    style={{ fontSize: 12, color: "#8B8BA7", background: "#13131A", border: "1px solid #2A2A38", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}
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

        {/* Streaming dots */}
        {isStreaming && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(0,201,124,0.1)", border: "1px solid rgba(0,201,124,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={14} style={{ color: "#00C97C" }} />
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C97C" }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {(error || rateLimitError) && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: "#EF4444", margin: 0 }}>
              {rateLimitError ?? "Something went wrong. Please try again."}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="tutor-input-wrap"
        style={{ flexShrink: 0, background: "#13131A", border: "1px solid #2A2A38", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-end", gap: 10, transition: "border-color 0.15s" }}
      >
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={dailyUsed >= dailyLimit ? "Daily message limit reached" : "Ask about AWS concepts, services, or exam strategies…"}
          disabled={dailyUsed >= dailyLimit || isStreaming}
          rows={1}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontSize: 14, color: "#F1F1F5", fontFamily: "var(--font-geist-sans)", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isStreaming || dailyUsed >= dailyLimit}
          style={{ width: 34, height: 34, borderRadius: 6, background: inputText.trim() && !isStreaming ? "#00C97C" : "#1C1C26", border: "none", cursor: inputText.trim() && !isStreaming ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.15s" }}
          onMouseEnter={(e) => { if (inputText.trim() && !isStreaming) e.currentTarget.style.background = "#00B06C"; }}
          onMouseLeave={(e) => { if (inputText.trim() && !isStreaming) e.currentTarget.style.background = "#00C97C"; }}
        >
          <Send size={14} style={{ color: inputText.trim() && !isStreaming ? "#fff" : "#52526B" }} />
        </button>
      </div>

      <p style={{ fontSize: 11, color: "#52526B", textAlign: "center", marginTop: 8, flexShrink: 0 }}>
        {mode === "socratic" ? "Socratic mode — guided discovery" : "Direct mode — clear explanations"}
        {" · "}
        <kbd style={{ background: "#1C1C26", border: "1px solid #2A2A38", borderRadius: 3, padding: "1px 4px", fontSize: 10 }}>Enter</kbd> to send, <kbd style={{ background: "#1C1C26", border: "1px solid #2A2A38", borderRadius: 3, padding: "1px 4px", fontSize: 10 }}>Shift+Enter</kbd> for newline
      </p>

      <style>{`
        .tutor-message p { margin: 0 0 8px; }
        .tutor-message p:last-child { margin-bottom: 0; }
        .tutor-message ul, .tutor-message ol { margin: 4px 0 8px; padding-left: 18px; }
        .tutor-message li { margin-bottom: 4px; }
        .tutor-message code { background: #1C1C26; border: 1px solid #2A2A38; border-radius: 3px; padding: 1px 5px; font-size: 12px; font-family: var(--font-geist-mono); }
        .tutor-message pre { background: #1C1C26; border: 1px solid #2A2A38; border-radius: 6px; padding: 12px; overflow-x: auto; margin: 8px 0; }
        .tutor-message pre code { background: none; border: none; padding: 0; }
        .tutor-input-wrap:focus-within { border-color: #3D3D52 !important; }
        @media (max-width: 640px) {
          .tutor-input-wrap textarea { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: "32px 0" }}>
        <div style={{ height: 36, width: 180, background: "#13131A", borderRadius: 8, marginBottom: 16 }} className="animate-pulse" />
        <div style={{ height: 400, background: "#13131A", borderRadius: 10, border: "1px solid #2A2A38" }} className="animate-pulse" />
      </div>
    }>
      <TutorContent />
    </Suspense>
  );
}
