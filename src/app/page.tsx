import Link from "next/link";

/**
 * Public landing page — minimal branded entry point.
 * Full marketing page ships in Layer 8 (per PRD Wk 8).
 * Authenticated users are redirected to /dashboard by the middleware.
 */
export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0F",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        fontFamily: "var(--font-geist-sans)",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#00C97C",
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: "0.15em",
            color: "#F1F1F5",
          }}
        >
          ARCUS
        </span>
      </div>

      {/* Headline */}
      <h1
        style={{
          fontSize: "clamp(32px, 5vw, 56px)",
          fontWeight: 700,
          color: "#F1F1F5",
          textAlign: "center",
          lineHeight: 1.15,
          maxWidth: 640,
          marginBottom: 16,
        }}
      >
        Pass your AWS exam.{" "}
        <span style={{ color: "#00C97C" }}>First try.</span>
      </h1>

      <p
        style={{
          fontSize: 18,
          color: "#8B8BA7",
          textAlign: "center",
          maxWidth: 480,
          lineHeight: 1.6,
          marginBottom: 40,
        }}
      >
        AI-powered adaptive practice, an expert AI tutor, and gamification
        that keeps you coming back every day.
      </p>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/signup"
          style={{
            height: 48,
            padding: "0 28px",
            background: "#00C97C",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            color: "#0A0A0F",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Get started free
        </Link>
        <Link
          href="/login"
          style={{
            height: 48,
            padding: "0 28px",
            background: "transparent",
            border: "1px solid #2A2A38",
            borderRadius: 8,
            fontSize: 15,
            color: "#F1F1F5",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Sign in
        </Link>
      </div>

      {/* Social proof hint */}
      <p style={{ marginTop: 40, fontSize: 13, color: "#52526B" }}>
        AWS SAA-C03 · 500+ verified questions · 82% pass rate
      </p>
    </div>
  );
}
