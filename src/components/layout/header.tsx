"use client";
import React, { useEffect, useState } from "react";
import { Search, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GLOBAL_SEARCH_OPEN_EVENT } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";
import { useMobileSidebar } from "@/components/layout/mobile-sidebar-context";

interface HeaderProps {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, action }: HeaderProps) {
  const [shortcut, setShortcut] = useState("⌘K");
  const { setOpen } = useMobileSidebar();

  useEffect(() => {
    if (
      typeof navigator !== "undefined" &&
      !/Mac|iPhone|iPad/.test(navigator.platform)
    ) {
      setShortcut("Ctrl+K");
    }
  }, []);

  function openSearch() {
    window.dispatchEvent(new Event(GLOBAL_SEARCH_OPEN_EVENT));
  }

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--background)] flex items-center px-4 md:px-6 gap-2 md:gap-4 sticky top-0 z-30">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center h-11 w-11 -ml-2 text-foreground hover:bg-white/5 rounded-sm transition-colors"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="text-sm font-semibold text-foreground flex-shrink-0 truncate min-w-0">
        {title}
      </h1>

      {/* Desktop: full search button */}
      <div className="hidden md:flex flex-1 max-w-sm ml-4">
        <button
          type="button"
          onClick={openSearch}
          className="w-full flex items-center gap-2 h-8 px-2.5 text-xs text-muted-foreground bg-[var(--surface)] border border-[var(--border)] hover:text-foreground hover:border-[var(--muted)] transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Rechercher…</span>
          <kbd className="hidden sm:inline-flex h-5 items-center px-1.5 text-[10px] font-mono bg-[var(--muted)] border border-[var(--border)] rounded-sm">
            {shortcut}
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1 md:gap-2 ml-auto">
        {/* Mobile: icon-only search */}
        <button
          type="button"
          onClick={openSearch}
          className="md:hidden inline-flex items-center justify-center h-11 w-11 text-foreground hover:bg-white/5 rounded-sm transition-colors"
          aria-label="Rechercher"
        >
          <Search className="h-4 w-4" />
        </button>

        <NotificationBell />

        {action && (
          <Button
            size="sm"
            onClick={action.onClick}
            className="h-11 md:h-8 text-sm md:text-xs gap-1.5 px-3 md:px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
