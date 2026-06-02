"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Building2,
  Kanban,
  FolderKanban,
  FileText,
  Loader2,
  UserSearch,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  globalSearch,
  type SearchEntityType,
  type SearchResult,
} from "@/lib/actions/search";

export const GLOBAL_SEARCH_OPEN_EVENT = "norva:search:open";

const TYPE_META: Record<
  SearchEntityType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  contact: { label: "Contacts", icon: Users },
  company: { label: "Entreprises", icon: Building2 },
  deal: { label: "Deals", icon: Kanban },
  lead: { label: "Leads", icon: UserSearch },
  project: { label: "Projets", icon: FolderKanban },
  invoice: { label: "Factures", icon: FileText },
};

const ORDER: SearchEntityType[] = [
  "contact",
  "company",
  "deal",
  "lead",
  "project",
  "invoice",
];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open via custom event (from Header) and ⌘K / Ctrl+K
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener(GLOBAL_SEARCH_OPEN_EVENT, handleOpen);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener(GLOBAL_SEARCH_OPEN_EVENT, handleOpen);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const r = await globalSearch(query);
        setResults(r);
      });
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<SearchEntityType, SearchResult[]>();
    for (const r of results) {
      const arr = map.get(r.type) ?? [];
      arr.push(r);
      map.set(r.type, arr);
    }
    return ORDER.flatMap((type) => {
      const items = map.get(type);
      if (!items || items.length === 0) return [];
      return [{ type, items }];
    });
  }, [results]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 gap-0 top-[20%] translate-y-0">
        <DialogTitle className="sr-only">Recherche globale</DialogTitle>

        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[var(--border)]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher contacts, entreprises, deals, projets, factures…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {pending && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center px-1.5 text-[10px] font-mono text-muted-foreground bg-[var(--muted)] border border-[var(--border)] rounded-sm">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              Tape au moins 2 caractères pour chercher.
            </p>
          ) : grouped.length === 0 && !pending ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              Aucun résultat pour <span className="font-mono">"{query}"</span>.
            </p>
          ) : (
            <div className="py-2">
              {grouped.map(({ type, items }) => {
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <div key={type} className="mb-2 last:mb-0">
                    <p className="px-4 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {meta.label}
                    </p>
                    <ul>
                      {items.map((r) => (
                        <li key={`${type}-${r.id}`}>
                          <button
                            type="button"
                            onClick={() => navigate(r.href)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 text-left",
                              "hover:bg-[var(--muted)]/50 transition-colors"
                            )}
                          >
                            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">
                                {r.label}
                              </p>
                              {r.sublabel && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {r.sublabel}
                                </p>
                              )}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
