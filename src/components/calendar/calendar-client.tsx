"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/lib/actions/calendar";

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const KIND_LABELS: Record<string, string> = {
  deal: "Deals",
  project_start: "Démarrages projet",
  project_end: "Échéances projet",
  task: "Tâches",
  invoice: "Échéances factures",
};

interface Props {
  year: number;
  month: number; // 0-11
  events: CalendarEvent[];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function CalendarClient({ year, month, events }: Props) {
  const router = useRouter();
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // Build the 6×7 grid (Monday-first)
  const days = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0
    const gridStart = new Date(year, month, 1 - startWeekday);

    const list: { date: Date; iso: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      list.push({
        date: d,
        iso: isoDate(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth: d.getMonth() === month,
      });
    }
    return list;
  }, [year, month]);

  // Liste des projets visibles ce mois (extraits depuis les events tâches projet)
  const availableProjects = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of events) {
      if (e.projectId && e.projectName) m.set(e.projectId, e.projectName);
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);

  // Apply filter
  const filteredEvents = useMemo(() => {
    if (projectFilter === "all") return events;
    return events.filter((e) => {
      // Filtre actif : on garde les events liés au projet sélectionné
      if (e.projectId === projectFilter) return true;
      // project_start / project_end utilisent un id préfixé "project-start-<id>" → on matche
      if (e.kind === "project_start" || e.kind === "project_end") {
        return e.id.endsWith(`-${projectFilter}`);
      }
      return false;
    });
  }, [events, projectFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filteredEvents) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [filteredEvents]);

  const today = todayISO();

  function navigateMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    const param = `${next.getFullYear()}-${pad(next.getMonth() + 1)}`;
    router.push(`/dashboard/calendrier?month=${param}`);
  }

  function goToday() {
    const now = new Date();
    const param = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    router.push(`/dashboard/calendrier?month=${param}`);
  }

  const totalEvents = filteredEvents.length;
  const kindCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of filteredEvents) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [filteredEvents]);

  return (
    <>
      <Header title="Calendrier" />
      <div className="flex-1 p-4 md:p-6 animate-fade-in space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => navigateMonth(-1)}
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => navigateMonth(1)}
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={goToday}
              className="h-7"
            >
              Aujourd&apos;hui
            </Button>
          </div>
          <h2 className="text-base font-semibold text-foreground">
            {MONTH_LABELS[month]} {year}
          </h2>

          {/* Filtre par projet */}
          {availableProjects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-7 px-2 text-xs bg-[var(--surface)] border border-[var(--border)] text-foreground focus:outline-none focus:border-accent/40"
            >
              <option value="all">Tous les projets</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {totalEvents} évènement{totalEvents > 1 ? "s" : ""}
            {Object.entries(kindCounts).length > 0 && " · "}
            {Object.entries(kindCounts)
              .map(([k, v]) => `${KIND_LABELS[k] ?? k}: ${v}`)
              .join(" · ")}
          </div>
        </div>

        {/* Calendar grid */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
            {WEEK_DAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-[10px] uppercase tracking-wide text-muted-foreground text-center"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-6">
            {days.map(({ date, iso, inMonth }) => {
              const dayEvents = eventsByDate.get(iso) ?? [];
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={cn(
                    "border-b border-r border-[var(--border)] p-1.5 min-h-[90px] md:min-h-[110px] flex flex-col gap-1",
                    !inMonth && "bg-[var(--surface)]/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center text-[11px] font-mono",
                        isToday
                          ? "h-5 w-5 bg-accent text-white rounded-full"
                          : !inMonth
                          ? "text-muted-foreground/60"
                          : "text-muted-foreground"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <Link
                        key={ev.id}
                        href={ev.href}
                        title={`${ev.label}${ev.meta ? ` — ${ev.meta}` : ""}`}
                        className="text-[11px] truncate px-1.5 py-0.5 hover:opacity-80 transition-opacity rounded-sm"
                        style={{
                          backgroundColor: `${ev.color}26`,
                          color: ev.color,
                          borderLeft: `2px solid ${ev.color}`,
                        }}
                      >
                        {ev.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          </div>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <Legend color="#3B7BF5" label="Échéance facture" />
          <Legend color="#EF4444" label="Facture en retard" />
          <Legend color="#22C55E" label="Démarrage projet" />
          <Legend color="#F59E0B" label="Deal — Devis" />
          <Legend color="#F97316" label="Deal — Négo / Tâche haute" />
          <Legend color="#6366F1" label="Deal — Prospect" />
        </div>
      </div>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5"
        style={{
          backgroundColor: `${color}26`,
          borderLeft: `2px solid ${color}`,
        }}
      />
      {label}
    </span>
  );
}
