"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Label } from "@/components/ui/label";

// ── Shared input style ────────────────────────────────────────────────────────

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

// ── Password strength ─────────────────────────────────────────────────────────

function getStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  const hasUpper   = /[A-Z]/.test(pw);
  const hasNumber  = /\d/.test(pw);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
  if (hasUpper && (hasNumber || hasSpecial)) return 3;
  if (hasUpper || hasNumber || hasSpecial) return 2;
  return 1;
}

const strengthColors = ["transparent", "#EF4444", "#F59E0B", "#4ADE80"] as const;
const strengthLabels = ["", "Weak", "Fair", "Strong"] as const;

function PasswordStrength({ password }: { password: string }) {
  const level = getStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {([1, 2, 3] as const).map((n) => (
          <div
            key={n}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: level >= n ? strengthColors[level] : "#2A2A38",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 11, color: strengthColors[level], marginTop: 4 }}>
        {strengthLabels[level]}
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
// TODO (Layer 9): Re-add Google and GitHub OAuth buttons here.
// handleOAuth, GoogleIcon, GitHubIcon, and OAuthButton were removed temporarily.

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    if (data.session) {
      // Email confirmation disabled — already authenticated
      router.push("/onboarding");
    } else {
      // Email confirmation required — show success state then redirect
      setSuccess(true);
      setIsLoading(false);
      setTimeout(() => router.push("/onboarding"), 1500);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <CheckCircle
          size={40}
          style={{ color: "#4ADE80", margin: "0 auto 16px" }}
        />
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#F1F1F5",
            marginBottom: 8,
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          Check your email
        </h2>
        <p style={{ fontSize: 14, color: "#8B8BA7", fontFamily: "var(--font-geist-sans)" }}>
          We sent a verification link to <strong style={{ color: "#F1F1F5" }}>{email}</strong>.
          You can start right away.
        </p>
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
        Create your account
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "#8B8BA7",
          marginBottom: 28,
          fontFamily: "var(--font-geist-sans)",
        }}
      >
        Start preparing for your AWS exam
      </p>

      <form onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="fullName" style={{ fontSize: 13, color: "#8B8BA7", display: "block", marginBottom: 6 }}>
            Full name
          </Label>
          <AuthInput
            id="fullName"
            type="text"
            placeholder="Jane Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div style={{ marginTop: 10 }}>
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
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />
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
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#00B06C";
          }}
          onMouseOut={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#00C97C";
          }}
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#8B8BA7" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#00C97C", textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
