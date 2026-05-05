"use client";
import React from "react";
import { Search, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Header({ title, action }: HeaderProps) {
  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--background)] flex items-center px-6 gap-4 sticky top-0 z-30">
      <h1 className="text-sm font-semibold text-foreground flex-shrink-0">{title}</h1>

      <div className="flex-1 max-w-sm ml-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-8 h-8 text-xs bg-[var(--surface)]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--muted)] transition-colors">
          <Bell className="h-4 w-4" />
        </button>
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
