import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | Arcus", default: "Arcus" },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#0A0A0F" }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Arcus" style={{ height: 36, width: "auto" }} />
        <span
          style={{
            marginTop: 10,
            fontSize: 13,
            color: "#8B8BA7",
            fontFamily: "var(--font-geist-sans)",
          }}
        >
          Pass your AWS exam. First try.
        </span>
      </div>

      {/* Card shell — pages fill this */}
      <div
        style={{
          background: "#13131A",
          border: "1px solid #2A2A38",
          borderRadius: 12,
          padding: 40,
          maxWidth: 400,
          width: "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}
