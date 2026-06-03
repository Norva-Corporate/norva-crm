"use client";

import React, { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { GlobalSearch } from "@/components/global-search";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { MobileSidebarContext } from "@/components/layout/mobile-sidebar-context";
import { useIsMobile } from "@/hooks/use-media-query";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

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

  function handleMobileNavigate() {
    setMobileOpen(false);
  }

  return (
    <MobileSidebarContext.Provider value={{ open: mobileOpen, setOpen: setMobileOpen }}>
      <div className="flex min-h-screen bg-[var(--background)]">
        {/* Desktop sidebar: hidden on mobile (<md), fixed on md+ */}
        <div className="hidden md:block">
          <Sidebar
            profile={profile}
            collapsed={hydrated ? collapsed : false}
            onToggle={handleToggle}
            variant="desktop"
          />
        </div>

        {/* Mobile sidebar drawer */}
        <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
          <DrawerContent
            side="left"
            className="w-[260px] sm:w-[260px] p-0"
            showCloseButton={false}
          >
            <DrawerTitle className="sr-only">Navigation</DrawerTitle>
            <Sidebar
              profile={profile}
              collapsed={false}
              onToggle={() => {}}
              variant="mobile"
              onNavigate={handleMobileNavigate}
            />
          </DrawerContent>
        </Drawer>

        <main
          className={cn(
            "flex-1 min-w-0 min-h-screen flex flex-col transition-[margin] duration-200",
            "ml-0",
            hydrated && collapsed ? "md:ml-16" : "md:ml-56"
          )}
        >
          {children}
        </main>
        <GlobalSearch />
        {/* Sur mobile, top-center pour ne pas se faire masquer par le drawer
            bottom des formulaires ou par le clavier virtuel. */}
        <Toaster
          theme="dark"
          position={isMobile ? "top-center" : "bottom-right"}
          richColors
        />
      </div>
    </MobileSidebarContext.Provider>
  );
}
