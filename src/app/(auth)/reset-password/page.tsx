"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";

const inputStyle: React.CSSProperties = {
  height: 44,
  background: "#1C1C26",
  border: "1px solid #2A2A38",
  borderRadius: 6,
  padding: "0 14px",
  fontSize: 14,
  color: "#F1F1F5",
  width: "100%",
  outline: "none",
  fontFamily: "var(--font-geist-sans)",
};

function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={inputStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "#3D3D52";
        e.currentTarget.style.boxShadow = "0 0 0 2px #00C97C20";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "#2A2A38";
        e.currentTarget.style.boxShadow = "none";
        props.onBlur?.(e);
      }}
    />
  );
}

export default function ResetPasswordPage() {
  const [email, setEmail]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [sent, setSent]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    });

    if (resetError) {
      setError(resetError.message);
      setIsLoading(false);
    } else {
      setSent(true);
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#1C1C26",
            border: "1px solid #2A2A38",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Mail size={22} style={{ color: "#00C97C" }} />
        </div>

        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "#F1F1F5",
            marginBottom: 8,
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          Check your email
        </h2>
        <p style={{ fontSize: 14, color: "#8B8BA7", marginBottom: 6, fontFamily: "var(--font-geist-sans)" }}>
          We sent a reset link to
        </p>
        <p style={{ fontSize: 14, color: "#F1F1F5", fontWeight: 500, marginBottom: 12, fontFamily: "var(--font-geist-sans)" }}>
          {email}
        </p>
        <p style={{ fontSize: 13, color: "#52526B", marginBottom: 28, fontFamily: "var(--font-geist-sans)" }}>
          It expires in 1 hour.
        </p>

        <Link
          href="/login"
          style={{
            fontSize: 13,
            color: "#8B8BA7",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          ← Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: "#F1F1F5",
          marginBottom: 6,
          fontFamily: "var(--font-geist-sans)",
        }}
      >
        Reset your password
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#8B8BA7",
          marginBottom: 28,
          fontFamily: "var(--font-geist-sans)",
        }}
      >
        We&apos;ll send you a link to reset it
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="email" style={{ fontSize: 13, color: "#8B8BA7", display: "block", marginBottom: 6 }}>
            Email
          </Label>
          <AuthInput
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {error && (
          <div
            style={{
              marginTop: 16,
              background: "#EF444420",
              border: "1px solid #EF444440",
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: 13,
              color: "#EF4444",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            marginTop: 20,
            width: "100%",
            height: 44,
            background: isLoading ? "#00C97C99" : "#00C97C",
            borderRadius: 6,
            border: "none",
            fontSize: 14,
            fontWeight: 500,
            color: "#0A0A0F",
            cursor: isLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "var(--font-geist-sans)",
            transition: "background 0.15s",
          }}
          onMouseOver={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#5254CC";
          }}
          onMouseOut={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#00C97C";
          }}
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {isLoading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Link
          href="/login"
          style={{
            fontSize: 13,
            color: "#8B8BA7",
            textDecoration: "none",
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "#F1F1F5")}
          onMouseOut={(e) => (e.currentTarget.style.color = "#8B8BA7")}
        >
          ← Back to login
        </Link>
      </div>
    </>
  );
}
