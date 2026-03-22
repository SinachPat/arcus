"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: fixed left sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {/* Main content — margin tracks sidebar width with a smooth transition */}
      <main
        style={{ transition: "margin-left 0.2s ease" }}
        className={collapsed ? "md:ml-[72px]" : "md:ml-60"}
      >
        <div
          style={{ maxWidth: 1100, margin: "0 auto" }}
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
