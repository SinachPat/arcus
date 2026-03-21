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

// ── OAuth buttons ─────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function OAuthButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        height: 44,
        background: "transparent",
        border: "1px solid #2A2A38",
        borderRadius: 6,
        fontSize: 14,
        color: "#F1F1F5",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        fontFamily: "var(--font-geist-sans)",
        transition: "border-color 0.15s",
      }}
      onMouseOver={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "#3D3D52")}
      onMouseOut={(e) => ((e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2A38")}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

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

  async function handleOAuth(provider: "google" | "github") {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
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
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#5254CC";
          }}
          onMouseOut={(e) => {
            if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#00C97C";
          }}
        >
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#2A2A38" }} />
        <span style={{ fontSize: 12, color: "#52526B" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#2A2A38" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <OAuthButton icon={<GoogleIcon />} label="Continue with Google" onClick={() => handleOAuth("google")} />
        <OAuthButton icon={<GitHubIcon />} label="Continue with GitHub"  onClick={() => handleOAuth("github")} />
      </div>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#8B8BA7" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "#00C97C", textDecoration: "none" }}>
          Sign in
        </Link>
      </p>
    </>
  );
}
