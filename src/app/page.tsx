"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  Brain, Zap, Trophy, Target, CheckCircle, ArrowRight,
  Flame, Shield, BarChart3, MessageSquare, Swords,
  ChevronRight, Users, Star, Clock, BookOpen, TrendingUp,
} from "lucide-react";

// ── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:       "#0A0A0F",
  surface:  "#13131A",
  border:   "#2A2A38",
  border2:  "#1E1E2A",
  accent:   "#00C97C",
  accentDim:"rgba(0,201,124,0.12)",
  text:     "#F1F1F5",
  muted:    "#8B8BA7",
  dim:      "#52526B",
  red:      "#EF4444",
  amber:    "#F59E0B",
  blue:     "#22D3EE",
  purple:   "#8B5CF6",
};

// ── Fade-up helper ────────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      height: 60,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px",
      background: scrolled ? "rgba(10,10,15,0.85)" : "transparent",
      backdropFilter: scrolled ? "blur(16px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
      transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
    }}>
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Arcus" style={{ height: 26, width: "auto" }} />

      {/* Links */}
      <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="nav-links">
        {[["#features", "Features"], ["#how", "How it works"], ["#pricing", "Pricing"]].map(([href, label]) => (
          <a key={href} href={href} style={{
            fontSize: 14, color: C.muted, textDecoration: "none",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = C.text)}
          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
          >{label}</a>
        ))}
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Link href="/login" style={{
          fontSize: 14, color: C.muted, textDecoration: "none", padding: "0 4px",
          transition: "color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = C.text)}
        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
        >Sign in</Link>
        <Link href="/signup" style={{
          height: 36, padding: "0 18px", background: C.accent,
          borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#0A0A0F",
          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#00b06c")}
        onMouseLeave={e => (e.currentTarget.style.background = C.accent)}
        >Get started <ArrowRight size={13} /></Link>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <div style={{
      position: "relative", minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "100px 24px 80px", textAlign: "center", overflow: "hidden",
    }}>
      {/* Dot grid */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(circle, ${C.border} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        opacity: 0.6,
      }} />

      {/* Green glow */}
      <div style={{
        position: "absolute", top: "-10%", left: "50%", transform: "translateX(-50%)",
        width: 800, height: 400, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at center, rgba(0,201,124,0.14) 0%, transparent 70%)",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760 }}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: 28 }}
        >
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 100,
            border: `1px solid rgba(0,201,124,0.3)`,
            background: "rgba(0,201,124,0.07)",
            fontSize: 13, color: C.accent, fontWeight: 500,
          }}>
            <Star size={12} fill={C.accent} />
            82% of Arcus users pass on their first attempt
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontSize: "clamp(40px, 7vw, 76px)",
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
            color: C.text,
            marginBottom: 24,
          }}
        >
          The sharpest way to{" "}
          <span style={{
            background: `linear-gradient(135deg, ${C.accent}, #00a8ff)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            pass your AWS exam.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          style={{
            fontSize: "clamp(16px, 2.2vw, 20px)",
            color: C.muted, lineHeight: 1.65,
            maxWidth: 560, margin: "0 auto 40px",
          }}
        >
          Adaptive AI that learns your weak spots. An expert tutor that guides, not just answers.
          Gamification that makes you want to come back tomorrow.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.26 }}
          style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
        >
          <Link href="/signup" style={{
            height: 52, padding: "0 28px",
            background: C.accent, borderRadius: 10,
            fontSize: 16, fontWeight: 600, color: "#0A0A0F",
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
            transition: "background 0.15s, transform 0.15s",
            boxShadow: "0 0 32px rgba(0,201,124,0.25)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#00b06c"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Start for free <ArrowRight size={16} />
          </Link>
          <a href="#how" style={{
            height: 52, padding: "0 28px",
            background: "transparent", borderRadius: 10,
            border: `1px solid ${C.border}`,
            fontSize: 16, fontWeight: 500, color: C.text,
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
            transition: "border-color 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = C.dim)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
          >
            See how it works
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ marginTop: 40, fontSize: 13, color: C.dim }}
        >
          No credit card required · Free forever plan · AWS SAA-C03
        </motion.p>
      </div>

      {/* Scroll arrow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)" }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronRight size={20} style={{ color: C.dim, transform: "rotate(90deg)" }} />
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: "82%",    label: "First-attempt pass rate" },
    { value: "500+",   label: "Verified questions" },
    { value: "400K+",  label: "Annual SAA-C03 test-takers" },
    { value: "$0",     label: "To start" },
  ];
  return (
    <div>
      <div style={{
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "40px 24px",
      }}>
        <div style={{
          maxWidth: 900, margin: "0 auto",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24,
        }} className="stats-bar">
          {stats.map(({ value, label }) => (
            <motion.div key={label} style={{ textAlign: "center" }}>
              <p style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 700, color: C.text, margin: 0, letterSpacing: "-0.02em" }}>
                {value}
              </p>
              <p style={{ fontSize: 13, color: C.dim, margin: "4px 0 0" }}>{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Brain size={22} style={{ color: C.accent }} />,
    tag: "AI Tutor",
    title: "Learns how you think, not just what you get wrong.",
    body: "Two modes. Socratic guides you to the answer through questions — building real understanding. Direct gives it to you straight when you're short on time. Switch mid-conversation. No judgment.",
    extras: ["Socratic mode (guided discovery)", "Direct mode (immediate answers)", "Context-aware from your wrong answers", "Generates practice questions on the spot"],
    color: C.accent,
  },
  {
    icon: <Target size={22} style={{ color: C.blue }} />,
    tag: "Adaptive Engine",
    title: "Stops wasting your time on things you already know.",
    body: "Your question feed adjusts in real-time based on mastery, spaced repetition intervals, and difficulty calibration. Every session is different. Every session is exactly what you need.",
    extras: ["Per-domain mastery tracking", "Spaced repetition scheduling", "Difficulty calibrates to your level", "Weak area drills on demand"],
    color: C.blue,
  },
  {
    icon: <Trophy size={22} style={{ color: C.amber }} />,
    tag: "Gamification",
    title: "The reason you'll actually finish your study plan.",
    body: "XP, streaks, shields, leaderboards, badges, a visual skill tree — all designed around behavioral science. Streak shields mean one missed day won't destroy your motivation. The leaderboard resets weekly so you always have a shot.",
    extras: ["XP & level progression", "Streak shields (no rage-quitting)", "Weekly leaderboard", "Skill tree with domain mastery"],
    color: C.amber,
  },
];

function Features() {
  return (
    <div>
      <div id="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px" }}>
        {/* Header */}
        <motion.div style={{ textAlign: "center", marginBottom: 64 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
            color: C.accent, display: "block", marginBottom: 16,
          }}>Why Arcus</span>
          <h2 style={{
            fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700,
            color: C.text, margin: 0, letterSpacing: "-0.025em", lineHeight: 1.15,
          }}>
            Built for people who need to pass,<br />not just study.
          </h2>
          <p style={{ fontSize: 17, color: C.muted, marginTop: 16, maxWidth: 500, margin: "16px auto 0", lineHeight: 1.6 }}>
            Existing tools give you questions. Arcus gives you a system — one that adapts, explains, and keeps you going.
          </p>
        </motion.div>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="features-grid">
          {FEATURES.map((f) => (
            <motion.div
              key={f.tag}
              
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: "32px 28px",
                display: "flex", flexDirection: "column", gap: 0,
                transition: "border-color 0.2s, transform 0.2s",
                cursor: "default",
              }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = f.color + "50")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: f.color + "18",
                border: `1px solid ${f.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 20,
              }}>
                {f.icon}
              </div>

              {/* Tag */}
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: f.color, marginBottom: 10,
              }}>{f.tag}</span>

              {/* Title */}
              <h3 style={{
                fontSize: 20, fontWeight: 600, color: C.text,
                lineHeight: 1.3, marginBottom: 14, letterSpacing: "-0.01em",
              }}>{f.title}</h3>

              {/* Body */}
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 24 }}>
                {f.body}
              </p>

              {/* Checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto" }}>
                {f.extras.map((e) => (
                  <div key={e} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={13} style={{ color: f.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: C.muted }}>{e}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    icon: <BookOpen size={20} style={{ color: C.accent }} />,
    title: "Take the diagnostic",
    body: "20 adaptive questions across all 6 SAA-C03 domains. Arcus maps exactly where you're strong and where you're losing marks — in under 12 minutes.",
  },
  {
    num: "02",
    icon: <Brain size={20} style={{ color: C.blue }} />,
    title: "Study with an AI that adapts",
    body: "Your daily sessions are built around your gaps — not a fixed syllabus. Ask the AI tutor anything. It adjusts to your knowledge level and your time pressure.",
  },
  {
    num: "03",
    icon: <Target size={20} style={{ color: "#a78bfa" }} />,
    title: "Simulate the real thing",
    body: "Full mock exams — 65 questions, 130 minutes, timed and scored exactly like AWS. See your readiness score trend toward 72% and beyond.",
  },
  {
    num: "04",
    icon: <CheckCircle size={20} style={{ color: C.amber }} />,
    title: "Pass. First try.",
    body: "82% of users who complete their Arcus study plan pass on their first attempt. Your study history, weak areas, and confidence score go with you into exam day.",
  },
];

function HowItWorks() {
  return (
    <div>
      <div id="how" style={{
        borderTop: `1px solid ${C.border}`,
        padding: "100px 24px",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <motion.div style={{ textAlign: "center", marginBottom: 64 }}>
            <span style={{
              fontSize: 12, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: C.accent, display: "block", marginBottom: 16,
            }}>How it works</span>
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700,
              color: C.text, letterSpacing: "-0.025em", lineHeight: 1.15, margin: 0,
            }}>
              From zero to certified,<br />in one focused system.
            </h2>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }} className="steps-grid">
            {STEPS.map((step, i) => (
              <motion.div key={step.num} style={{ position: "relative" }}>
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div style={{
                    position: "absolute", top: 22, left: "calc(100% - 8px)", width: "100%",
                    height: 1, background: `linear-gradient(to right, ${C.border}, transparent)`,
                    zIndex: 0,
                  }} className="step-connector" />
                )}
                <div style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 14, padding: "24px 20px", position: "relative", zIndex: 1,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "#1C1C26", border: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 16,
                  }}>
                    {step.icon}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: C.dim,
                    letterSpacing: "0.1em", display: "block", marginBottom: 8,
                  }}>{step.num}</span>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 10, lineHeight: 1.3 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, margin: 0 }}>
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tutor callout ─────────────────────────────────────────────────────────────
function TutorCallout() {
  const [mode, setMode] = useState<"socratic" | "direct">("socratic");
  const convos = {
    socratic: [
      { role: "user",      text: "I got this question wrong — S3 vs EFS for a containerised workload." },
      { role: "assistant", text: "Before I explain, let me ask: what's the key difference between object storage and a shared file system? Think about how containers mount data." },
      { role: "user",      text: "Object storage is accessed over HTTP, file systems are mounted..." },
      { role: "assistant", text: "Exactly. So if your containers need a POSIX-compatible mount point that multiple instances can read and write simultaneously — which fits that model?" },
    ],
    direct: [
      { role: "user",      text: "I got this question wrong — S3 vs EFS for a containerised workload." },
      { role: "assistant", text: "The answer is EFS. Here's why: containers running on ECS/EKS often need a shared, POSIX-compatible filesystem that multiple tasks can mount simultaneously. S3 is object storage — no filesystem semantics, no concurrent writes to the same file. EFS gives you NFS-style shared access, auto-scaling, and works natively with ECS via EFS volume mounts." },
      { role: "assistant", text: "Wrong options breakdown: S3 ✗ (no filesystem), EBS ✗ (single-instance only), FSx ✗ (Windows workloads). Want 3 practice questions on storage selection?" },
    ],
  };

  return (
    <div>
      <div style={{
        borderTop: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, #0A0A0F 0%, #0d0d16 100%)`,
        padding: "100px 24px",
      }}>
        <div style={{ maxWidth: 1060, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="tutor-split">

          {/* Left: copy */}
          <FadeUp>
            <span style={{
              fontSize: 12, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: C.accent, display: "block", marginBottom: 16,
            }}>AI Tutor</span>
            <h2 style={{
              fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 700, color: C.text,
              letterSpacing: "-0.025em", lineHeight: 1.2, marginBottom: 20,
            }}>
              Two modes.<br />One goal: you actually understand it.
            </h2>
            <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, marginBottom: 32 }}>
              <strong style={{ color: C.text }}>Socratic mode</strong> guides you with questions so the understanding is yours, not borrowed.{" "}
              <strong style={{ color: C.text }}>Direct mode</strong> gives you the answer immediately — for when you need clarity, not a lesson.
              Switch any time, mid-conversation.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { icon: <MessageSquare size={15} />, text: "Context pre-loaded from every wrong answer" },
                { icon: <BookOpen size={15} />, text: "Generates practice questions on the spot" },
                { icon: <TrendingUp size={15} />, text: "Reads your mastery data to calibrate depth" },
                { icon: <Zap size={15} />, text: "Saves flashcards to spaced-repetition deck" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, background: C.accentDim,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.accent, flexShrink: 0,
                  }}>{icon}</div>
                  <span style={{ fontSize: 14, color: C.muted }}>{text}</span>
                </div>
              ))}
            </div>
          </FadeUp>

          {/* Right: live demo */}
          <FadeUp>
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 16, overflow: "hidden",
            }}>
              {/* Chat header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: C.accentDim, border: `1px solid rgba(0,201,124,0.3)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Brain size={12} style={{ color: C.accent }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>AI Tutor</span>
                </div>
                {/* Mode toggle */}
                <div style={{
                  display: "flex", background: "#0A0A0F",
                  border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden",
                }}>
                  {(["socratic", "direct"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} style={{
                      padding: "4px 12px", fontSize: 11, fontWeight: mode === m ? 600 : 400,
                      color: mode === m ? C.accent : C.dim,
                      background: mode === m ? "rgba(0,201,124,0.1)" : "transparent",
                      border: "none", cursor: "pointer", fontFamily: "inherit",
                      transition: "color 0.15s, background 0.15s", textTransform: "capitalize",
                    }}>
                      {m === "socratic" ? "🧠 Socratic" : "⚡ Direct"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 12, minHeight: 280 }}>
                {convos[mode].map((msg, i) => (
                  <motion.div
                    key={`${mode}-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{
                      maxWidth: "85%",
                      background: msg.role === "user" ? "rgba(0,201,124,0.1)" : "#1C1C26",
                      border: `1px solid ${msg.role === "user" ? "rgba(0,201,124,0.2)" : C.border}`,
                      borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                      padding: "10px 14px",
                      fontSize: 13, color: C.text, lineHeight: 1.6,
                    }}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </div>
  );
}

// ── Gamification ──────────────────────────────────────────────────────────────
function Gamification() {
  const badges = [
    { icon: "🔥", label: "Week Warrior", sub: "7-day streak", color: "#F97316" },
    { icon: "🎯", label: "Domain Master", sub: "90%+ in Security", color: C.accent },
    { icon: "⚡", label: "Speed Demon", sub: "Mock in <60% time", color: C.blue },
    { icon: "🏛️", label: "The Architect", sub: "85%+ on full mock", color: "#a78bfa" },
  ];

  return (
    <div>
      <div style={{
        borderTop: `1px solid ${C.border}`,
        padding: "100px 24px",
      }}>
        <div style={{ maxWidth: 1060, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="tutor-split">

            {/* Left: widgets */}
            <motion.div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Streak widget */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "20px 22px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Flame size={36} style={{ color: "#F97316", filter: "drop-shadow(0 0 8px #F9731640)" }} />
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>23 day streak</p>
                    <p style={{ fontSize: 12, color: C.dim, margin: "2px 0 0" }}>Study today to keep it alive</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[1,2,3].map((i) => (
                    <Shield key={i} size={18} style={{ color: i <= 2 ? C.accent : C.border }} />
                  ))}
                </div>
              </div>

              {/* XP progress */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "20px 22px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: C.muted }}>Level 14 · Apprentice</span>
                  <span style={{ fontSize: 13, color: C.text, fontFamily: "var(--font-geist-mono)" }}>3,240 / 5,000 XP</span>
                </div>
                <div style={{ height: 6, background: "#1C1C26", borderRadius: 100, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: "64.8%" }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{ height: "100%", background: C.accent, borderRadius: 100 }}
                  />
                </div>
              </div>

              {/* Badges */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "20px 22px",
              }}>
                <p style={{ fontSize: 12, color: C.dim, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Badges earned</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {badges.map((b) => (
                    <div key={b.label} style={{ textAlign: "center" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 10, margin: "0 auto 6px",
                        background: b.color + "18", border: `1px solid ${b.color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 20,
                      }}>{b.icon}</div>
                      <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: 0, lineHeight: 1.3 }}>{b.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right: copy */}
            <FadeUp>
              <span style={{
                fontSize: 12, fontWeight: 600, letterSpacing: "0.12em",
                textTransform: "uppercase", color: C.amber, display: "block", marginBottom: 16,
              }}>Gamification</span>
              <h2 style={{
                fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 700, color: C.text,
                letterSpacing: "-0.025em", lineHeight: 1.2, marginBottom: 20,
              }}>
                The reason you'll still be studying in week four.
              </h2>
              <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, marginBottom: 32 }}>
                Study fatigue kills 40–60% of exam candidates before they book. Arcus is engineered around behavioral science to make daily study feel worth it — streaks, XP, badges, and a leaderboard that resets every week so you always have a shot at the top.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { icon: <Flame size={15} style={{ color: C.amber }} />, text: "Daily streaks with Streak Shields — one missed day won't destroy your momentum" },
                  { icon: <Trophy size={15} style={{ color: C.amber }} />, text: "Weekly leaderboard resets every Monday — always competitive" },
                  { icon: <Zap size={15} style={{ color: C.amber }} />, text: "XP multipliers, first-attempt bonuses, and difficulty rewards" },
                  { icon: <Swords size={15} style={{ color: C.amber }} />, text: "1v1 challenge battles coming in Phase 2" },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, background: "rgba(245,158,11,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                    }}>{icon}</div>
                    <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{text}</span>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Enough to know Arcus works.",
    cta: "Start for free",
    href: "/signup",
    featured: false,
    features: [
      "20 questions per day",
      "Full diagnostic test",
      "3 AI Tutor messages per day",
      "First mock exam free",
      "Streak & XP system",
      "Weekly leaderboard",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    description: "For engineers serious about passing.",
    cta: "Start Pro free",
    href: "/signup?plan=pro",
    featured: true,
    features: [
      "Unlimited practice questions",
      "50 AI Tutor messages per day",
      "Unlimited mock exams",
      "Full analytics & readiness score",
      "Streak recovery (500 XP)",
      "Priority AI tutor responses",
      "Post-exam AI study plan",
      "All gamification features",
    ],
  },
  {
    name: "Premium",
    price: "$49",
    period: "/ month",
    description: "Maximum firepower for exam day.",
    cta: "Start Premium free",
    href: "/signup?plan=premium",
    featured: false,
    features: [
      "Everything in Pro",
      "150 AI Tutor messages per day",
      "Predicted pass date",
      "1v1 challenge mode (Phase 2)",
      "Custom study themes",
      "Mentor badge & beta access",
      "Team progress sharing",
    ],
  },
];

function Pricing() {
  return (
    <div>
      <div id="pricing" style={{
        borderTop: `1px solid ${C.border}`,
        padding: "100px 24px",
        background: "linear-gradient(180deg, #0A0A0F 0%, #0d0d16 50%, #0A0A0F 100%)",
      }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <motion.div style={{ textAlign: "center", marginBottom: 60 }}>
            <span style={{
              fontSize: 12, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: C.accent, display: "block", marginBottom: 16,
            }}>Pricing</span>
            <h2 style={{
              fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 700, color: C.text,
              letterSpacing: "-0.025em", lineHeight: 1.15, margin: 0,
            }}>Simple pricing. No exam retake fees.</h2>
            <p style={{ fontSize: 16, color: C.muted, marginTop: 14 }}>
              Cancel anytime. No credit card required to start.
            </p>
          </motion.div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="pricing-grid">
            {PLANS.map((plan) => (
              <motion.div
                key={plan.name}
                
                style={{
                  background: plan.featured ? "linear-gradient(145deg, #13131A, #151520)" : C.surface,
                  border: `1px solid ${plan.featured ? C.accent + "60" : C.border}`,
                  borderRadius: 16, padding: "32px 28px",
                  position: "relative", display: "flex", flexDirection: "column",
                  boxShadow: plan.featured ? `0 0 40px rgba(0,201,124,0.12)` : "none",
                }}
              >
                {plan.featured && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: C.accent, color: "#0A0A0F",
                    fontSize: 11, fontWeight: 700, padding: "3px 14px", borderRadius: 100,
                    letterSpacing: "0.06em", whiteSpace: "nowrap",
                  }}>
                    MOST POPULAR
                  </div>
                )}

                <p style={{ fontSize: 13, fontWeight: 700, color: plan.featured ? C.accent : C.muted, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  {plan.name}
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
                  <span style={{ fontSize: 40, fontWeight: 700, color: C.text, letterSpacing: "-0.03em" }}>
                    {plan.price}
                  </span>
                  <span style={{ fontSize: 14, color: C.dim }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 28, lineHeight: 1.5 }}>
                  {plan.description}
                </p>

                <Link href={plan.href} style={{
                  height: 42, borderRadius: 8, fontSize: 14, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textDecoration: "none", marginBottom: 28,
                  background: plan.featured ? C.accent : "transparent",
                  color: plan.featured ? "#0A0A0F" : C.text,
                  border: plan.featured ? "none" : `1px solid ${C.border}`,
                  transition: "background 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => {
                  if (plan.featured) e.currentTarget.style.background = "#00b06c";
                  else e.currentTarget.style.borderColor = C.dim;
                }}
                onMouseLeave={e => {
                  if (plan.featured) e.currentTarget.style.background = C.accent;
                  else e.currentTarget.style.borderColor = C.border;
                }}
                >
                  {plan.cta}
                </Link>

                <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: "auto" }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <CheckCircle size={13} style={{ color: plan.featured ? C.accent : C.dim, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: plan.featured ? C.muted : C.dim }}>{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <div>
      <div style={{
        borderTop: `1px solid ${C.border}`,
        padding: "100px 24px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", bottom: "-30%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 400, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(0,201,124,0.1) 0%, transparent 70%)",
        }} />

        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <FadeUp>
            <h2 style={{
              fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 700, color: C.text,
              letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20,
            }}>
              Your exam is booked.<br />
              <span style={{ color: C.accent }}>Are you ready?</span>
            </h2>
            <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.65, marginBottom: 40 }}>
              Join engineers who stopped guessing and started knowing. Free to start. No credit card.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/signup" style={{
                height: 54, padding: "0 32px",
                background: C.accent, borderRadius: 10,
                fontSize: 16, fontWeight: 600, color: "#0A0A0F",
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                boxShadow: "0 0 40px rgba(0,201,124,0.28)",
                transition: "background 0.15s, transform 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#00b06c"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                Start studying free <ArrowRight size={16} />
              </Link>
            </div>
            <p style={{ marginTop: 20, fontSize: 13, color: C.dim }}>
              82% pass rate · No credit card · Cancel anytime
            </p>
          </FadeUp>
        </div>
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      borderTop: `1px solid ${C.border}`,
      padding: "48px 24px 40px",
    }}>
      <div style={{ maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }} className="footer-grid">
          {/* Brand */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Arcus" style={{ height: 24, marginBottom: 14 }} />
            <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, maxWidth: 220 }}>
              AI-powered exam prep for AWS certifications. Built for engineers who need to pass on their first try.
            </p>
          </div>

          {/* Product */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Product</p>
            {([
              ["Features",     "#features"],
              ["Pricing",      "#pricing"],
              ["How it works", "#how"],
              ["Study Plans",  "/onboarding"],
            ] as [string, string][]).map(([l, href]) => (
              <p key={l} style={{ marginBottom: 10 }}>
                <a href={href} style={{ fontSize: 13, color: C.dim, textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.muted)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
                >{l}</a>
              </p>
            ))}
          </div>

          {/* Exams */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Exams</p>
            {["AWS SAA-C03", "AWS DVA-C02 (soon)", "AWS SOA-C02 (soon)", "AWS ANS-C01 (soon)"].map((l) => (
              <p key={l} style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: C.dim }}>{l}</span>
              </p>
            ))}
          </div>

          {/* Company */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Company</p>
            {[["Privacy", "/privacy"], ["Terms", "/terms"], ["Sign in", "/login"], ["Sign up", "/signup"]].map(([l, href]) => (
              <p key={l} style={{ marginBottom: 10 }}>
                <Link href={href} style={{ fontSize: 13, color: C.dim, textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.muted)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.dim)}
                >{l}</Link>
              </p>
            ))}
          </div>
        </div>

        <div style={{
          paddingTop: 24, borderTop: `1px solid ${C.border2}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <p style={{ fontSize: 12, color: C.dim, margin: 0 }}>
            © {new Date().getFullYear()} Arcus. All rights reserved.
          </p>
          <p style={{ fontSize: 12, color: C.dim, margin: 0 }}>
            AWS and SAA-C03 are trademarks of Amazon Web Services. Arcus is not affiliated with AWS.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: C.bg, fontFamily: "var(--font-geist-sans)", color: C.text, minHeight: "100vh" }}>
      <Nav />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <TutorCallout />
      <Gamification />
      <Pricing />
      <FinalCTA />
      <Footer />

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        @media (max-width: 900px) {
          .nav-links { display: none !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .step-connector { display: none !important; }
          .pricing-grid { grid-template-columns: 1fr !important; max-width: 440px; margin: 0 auto; }
          .tutor-split { grid-template-columns: 1fr !important; gap: 40px !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-bar { grid-template-columns: repeat(2, 1fr) !important; }
        }

        @media (max-width: 480px) {
          .steps-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr !important; }
          .stats-bar { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
