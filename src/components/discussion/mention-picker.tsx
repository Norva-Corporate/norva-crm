"use client";

import { useEffect, useRef, useState } from "react";
import {
  AtSign,
  Briefcase,
  FileText,
  FolderKanban,
  ListChecks,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import { useMentionSearch } from "@/hooks/use-mention-search";
import type { Mention, MentionType } from "@/types";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<MentionType, React.ComponentType<{ className?: string }>> = {
  user: AtSign,
  company: Briefcase,
  contact: UserIcon,
  project: FolderKanban,
  task: ListChecks,
  invoice: FileText,
};

interface MentionPickerProps {
  query: string;
  onSelect: (mention: Mention) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function MentionPicker({
  query,
  onSelect,
  onClose,
  position,
}: MentionPickerProps) {
  const { results, loading } = useMentionSearch(query);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const flatItems: Mention[] = results.flatMap((g) => g.items);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (flatItems.length === 0) {
        if (e.key === "Escape") onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % flatItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(flatItems[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flatItems, activeIndex, onSelect, onClose]);

  let runningIndex = -1;

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-72 max-h-72 overflow-y-auto bg-[var(--card)] border border-[var(--border)] shadow-lg rounded-sm"
      style={{ top: position.top, left: position.left }}
    >
      {loading && results.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Recherche…
        </div>
      ) : results.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Aucun résultat
        </div>
      ) : (
        <ul className="py-1">
          {results.map((group) => (
            <li key={group.type}>
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              <ul>
                {group.items.map((item) => {
                  runningIndex += 1;
                  const isActive = runningIndex === activeIndex;
                  const Icon = TYPE_ICON[item.type] ?? AtSign;
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        onMouseEnter={() => setActiveIndex(runningIndex)}
                        onClick={() => onSelect(item)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors",
                          isActive
                            ? "bg-accent/15 text-accent"
                            : "text-foreground hover:bg-white/5"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            isActive ? "text-accent" : "text-muted-foreground"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
