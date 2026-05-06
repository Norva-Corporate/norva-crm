"use client";

import React, { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalSearch } from "@/components/global-search";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

const STORAGE_KEY = "norva.sidebar.collapsed";

interface DashboardShellProps {
  profile: Profile | null;
  children: React.ReactNode;
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar
        profile={profile}
        collapsed={hydrated ? collapsed : false}
        onToggle={handleToggle}
      />
      <main
        className={cn(
          "flex-1 min-h-screen flex flex-col transition-[margin] duration-200",
          collapsed && hydrated ? "ml-16" : "ml-56"
        )}
      >
        {children}
      </main>
      <GlobalSearch />
      <Toaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
