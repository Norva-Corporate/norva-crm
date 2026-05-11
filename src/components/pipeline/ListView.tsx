"use client";
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { STAGES, getStage } from "./stages";
import type { DealStage, DealWithRelations } from "@/types";

type SortKey =
  | "title"
  | "contact"
  | "company"
  | "value"
  | "stage"
  | "expected_close_date"
  | "owner";
type SortDir = "asc" | "desc";

interface ListViewProps {
  deals: DealWithRelations[];
  onOpenDeal: (deal: DealWithRelations) => void;
  onDeleteDeal: (deal: DealWithRelations) => void;
}

const ALL = "__all__";

export function ListView({ deals, onOpenDeal, onDeleteDeal }: ListViewProps) {
  const [stageFilter, setStageFilter] = useState<DealStage | typeof ALL>(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("expected_close_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filtered = useMemo(() => {
    if (stageFilter === ALL) return deals;
    return deals.filter((d) => d.stage === stageFilter);
  }, [deals, stageFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const cmp = compare(va, vb);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-3">
      {/* Filtres chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Chip
          active={stageFilter === ALL}
          onClick={() => setStageFilter(ALL)}
        >
          Tous ({deals.length})
        </Chip>
        {STAGES.map((s) => {
          const count = deals.filter((d) => d.stage === s.key).length;
          return (
            <Chip
              key={s.key}
              active={stageFilter === s.key}
              onClick={() => setStageFilter(s.key)}
              accent={s.accent}
            >
              {s.label} ({count})
            </Chip>
          );
        })}
      </div>

      {/* Mobile : liste de cartes */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 ? (
          <Card className="px-4 py-12 text-center text-sm text-muted-foreground">
            Aucun deal dans cette vue.
          </Card>
        ) : (
          sorted.map((deal) => {
            const stageDef = getStage(deal.stage);
            return (
              <Card
                key={deal.id}
                onClick={() => onOpenDeal(deal)}
                className="p-3 cursor-pointer hover:border-accent/30 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {deal.title}
                      </p>
                      <Badge
                        variant={stageDef.badgeVariant}
                        className="shrink-0 text-[10px]"
                      >
                        {stageDef.label}
                      </Badge>
                    </div>
                    <div className="space-y-0.5 mt-1 text-[11px] text-muted-foreground">
                      {deal.contact && (
                        <p className="truncate">
                          {deal.contact.first_name} {deal.contact.last_name}
                        </p>
                      )}
                      {deal.company?.name && (
                        <p className="truncate">{deal.company.name}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                        {deal.value != null
                          ? formatCurrency(deal.value)
                          : "—"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(deal.expected_close_date)}
                      </span>
                    </div>
                    {deal.assignee?.full_name && (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        Owner : {deal.assignee.full_name}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenDeal(deal)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteDeal(deal)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop : tableau */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <SortableTh
                  active={sortKey === "title"}
                  dir={sortDir}
                  onClick={() => toggleSort("title")}
                >
                  Titre
                </SortableTh>
                <SortableTh
                  active={sortKey === "contact"}
                  dir={sortDir}
                  onClick={() => toggleSort("contact")}
                >
                  Contact
                </SortableTh>
                <SortableTh
                  active={sortKey === "company"}
                  dir={sortDir}
                  onClick={() => toggleSort("company")}
                >
                  Entreprise
                </SortableTh>
                <SortableTh
                  active={sortKey === "value"}
                  dir={sortDir}
                  onClick={() => toggleSort("value")}
                  align="right"
                >
                  Valeur
                </SortableTh>
                <SortableTh
                  active={sortKey === "stage"}
                  dir={sortDir}
                  onClick={() => toggleSort("stage")}
                >
                  Stage
                </SortableTh>
                <SortableTh
                  active={sortKey === "expected_close_date"}
                  dir={sortDir}
                  onClick={() => toggleSort("expected_close_date")}
                >
                  Closing
                </SortableTh>
                <SortableTh
                  active={sortKey === "owner"}
                  dir={sortDir}
                  onClick={() => toggleSort("owner")}
                >
                  Owner
                </SortableTh>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    Aucun deal dans cette vue.
                  </td>
                </tr>
              ) : (
                sorted.map((deal, idx) => {
                  const stageDef = getStage(deal.stage);
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => onOpenDeal(deal)}
                      className={cn(
                        "border-b border-[var(--border)] transition-colors hover:bg-[var(--muted)]/30 cursor-pointer",
                        idx % 2 === 0 ? "bg-[#0B1220]" : "bg-[#111927]"
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {deal.title}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {deal.contact
                          ? `${deal.contact.first_name} ${deal.contact.last_name}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {deal.company?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground tabular-nums text-right">
                        {deal.value != null ? formatCurrency(deal.value) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={stageDef.badgeVariant}>
                          {stageDef.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(deal.expected_close_date)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {deal.assignee?.full_name ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenDeal(deal)}>
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteDeal(deal)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Chip({
  active,
  accent,
  onClick,
  children,
}: {
  active: boolean;
  accent?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-2.5 h-7 text-xs border transition-colors",
        active
          ? "bg-accent/15 text-accent border-accent/30"
          : "border-[var(--border)] text-muted-foreground hover:text-foreground hover:bg-[var(--muted)]"
      )}
      style={
        active && accent
          ? {
              background: `${accent}20`,
              color: accent,
              borderColor: `${accent}50`,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function SortableTh({
  active,
  dir,
  onClick,
  align = "left",
  children,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <th className={cn("px-4 py-2.5", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {children}
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </th>
  );
}

function sortValue(deal: DealWithRelations, key: SortKey): string | number {
  switch (key) {
    case "title":
      return deal.title.toLowerCase();
    case "contact":
      return deal.contact
        ? `${deal.contact.first_name} ${deal.contact.last_name}`.toLowerCase()
        : "";
    case "company":
      return deal.company?.name.toLowerCase() ?? "";
    case "value":
      return deal.value ?? -Infinity;
    case "stage": {
      const order: Record<DealStage, number> = {
        prospect: 0,
        qualified: 1,
        proposal: 2,
        negotiation: 3,
        won: 4,
        lost: 5,
      };
      return order[deal.stage];
    }
    case "expected_close_date":
      return deal.expected_close_date
        ? new Date(deal.expected_close_date).getTime()
        : Number.MAX_SAFE_INTEGER;
    case "owner":
      return deal.assignee?.full_name?.toLowerCase() ?? "";
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}
