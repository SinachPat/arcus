import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { TRPCProvider } from "@/components/providers/trpc-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { template: "%s | Arcus", default: "Arcus — AWS Exam Prep" },
  description: "AI-powered gamified exam prep. Pass your AWS exam, first try.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      style={{ background: "#0A0A0F", color: "#F1F1F5" }}
    >
      <body className="min-h-full flex flex-col">
        <TRPCProvider>
          <PostHogProvider>
            {children}
            <Toaster />
          </PostHogProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
