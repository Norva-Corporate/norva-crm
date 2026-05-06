"use client";
import React, { useEffect, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GLOBAL_SEARCH_OPEN_EVENT } from "@/components/global-search";
import { NotificationBell } from "@/components/notification-bell";

interface HeaderProps {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, action }: HeaderProps) {
  const [shortcut, setShortcut] = useState("⌘K");

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
    <header className="h-14 border-b border-[var(--border)] bg-[var(--background)] flex items-center px-6 gap-4 sticky top-0 z-30">
      <h1 className="text-sm font-semibold text-foreground flex-shrink-0">{title}</h1>

      <div className="flex-1 max-w-sm ml-4">
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

      <div className="flex items-center gap-2 ml-auto">
        <NotificationBell />
        {action && (
          <Button size="sm" onClick={action.onClick} className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        )}
      </div>
    </header>
  );
}
