"use client";

import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: fixed left sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content — offset right by sidebar width on desktop */}
      <main
        className="md:ml-60" // 240px = 60 * 4
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
          }}
          className="px-4 py-5 md:px-6 md:py-8 pb-24 md:pb-8"
        >
          {children}
        </div>
      </main>

      {/* Mobile: fixed bottom navigation */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
