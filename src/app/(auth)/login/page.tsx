"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// TODO (Layer 9): Re-add Google and GitHub OAuth buttons here.
// GoogleIcon, GitHubIcon, OAuthButton, and handleOAuth were removed temporarily.

// ── Reusable styled input ─────────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      if (authError.message.toLowerCase().includes("invalid")) {
        setError("Invalid email or password.");
      } else if (authError.status === 429) {
        setError("Too many attempts. Try again in 15 minutes.");
      } else {
        setError(authError.message);
      }
      setIsLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <>
      {/* Headings */}
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: "#F1F1F5",
          marginBottom: 6,
          fontFamily: "var(--font-geist-sans)",
        }}
      >
        Welcome back
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#8B8BA7",
          marginBottom: 28,
          fontFamily: "var(--font-geist-sans)",
        }}
      >
        Sign in to continue studying
      </p>

      {/* Form */}
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

        <div style={{ marginTop: 10 }}>
          <Label htmlFor="password" style={{ fontSize: 13, color: "#8B8BA7", display: "block", marginBottom: 6 }}>
            Password
          </Label>
          <AuthInput
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {/* Forgot password */}
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <Link
            href="/reset-password"
            style={{ fontSize: 12, color: "#8B8BA7", textDecoration: "none" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#F1F1F5")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#8B8BA7")}
          >
            Forgot password?
          </Link>
        </div>

        {/* Error */}
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

        {/* Submit */}
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
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#00B06C";
          }}
          onMouseOut={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#00C97C";
          }}
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Sign up link */}
      <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#8B8BA7" }}>
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          style={{ color: "#00C97C", textDecoration: "none" }}
        >
          Sign up
        </Link>
      </p>
    </>
  );
}

