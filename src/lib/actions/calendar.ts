"use server";

import { createClient } from "@/lib/supabase/server";

export type CalendarEventKind =
  | "deal"
  | "project_start"
  | "project_end"
  | "task"
  | "invoice";

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  label: string;
  date: string; // YYYY-MM-DD
  color: string;
  href: string;
  meta?: string | null;
}

export async function getCalendarEvents(
  fromISO: string,
  toISO: string
): Promise<CalendarEvent[]> {
  const supabase = await createClient();

  const [deals, projects, tasks, invoices] = await Promise.all([
    supabase
      .from("deals")
      .select("id, title, stage, value, expected_close_date")
      .not("expected_close_date", "is", null)
      .gte("expected_close_date", fromISO)
      .lte("expected_close_date", toISO),
    supabase
      .from("projects")
      .select("id, name, status, start_date, end_date")
      .or(
        `and(start_date.gte.${fromISO},start_date.lte.${toISO}),and(end_date.gte.${fromISO},end_date.lte.${toISO})`
      ),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .not("due_date", "is", null)
      .gte("due_date", fromISO)
      .lte("due_date", toISO),
    supabase
      .from("invoices")
      .select("id, number, type, status, due_date, total")
      .eq("type", "invoice")
      .not("due_date", "is", null)
      .gte("due_date", fromISO)
      .lte("due_date", toISO),
  ]);

  const STAGE_COLOR: Record<string, string> = {
    prospect: "#6366F1",
    qualified: "#3B82F6",
    proposal: "#F59E0B",
    negotiation: "#F97316",
    won: "#22C55E",
    lost: "#9CA3AF",
  };
  const PRIO_COLOR: Record<string, string> = {
    low: "#9CA3AF",
    normal: "#3B7BF5",
    high: "#F97316",
    urgent: "#EF4444",
  };

  const events: CalendarEvent[] = [];

  for (const d of deals.data ?? []) {
    if (!d.expected_close_date) continue;
    events.push({
      id: `deal-${d.id}`,
      kind: "deal",
      label: d.title,
      date: d.expected_close_date,
      color: STAGE_COLOR[d.stage] ?? "#3B7BF5",
      href: "/dashboard/pipeline",
      meta: d.value
        ? new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(Number(d.value))
        : null,
    });
  }

  for (const p of projects.data ?? []) {
    if (p.start_date && p.start_date >= fromISO && p.start_date <= toISO) {
      events.push({
        id: `project-start-${p.id}`,
        kind: "project_start",
        label: `▶ ${p.name}`,
        date: p.start_date,
        color: "#22C55E",
        href: `/dashboard/projets/${p.id}`,
        meta: "Démarrage",
      });
    }
    if (p.end_date && p.end_date >= fromISO && p.end_date <= toISO) {
      events.push({
        id: `project-end-${p.id}`,
        kind: "project_end",
        label: `■ ${p.name}`,
        date: p.end_date,
        color: "#3B7BF5",
        href: `/dashboard/projets/${p.id}`,
        meta: "Échéance",
      });
    }
  }

  for (const t of tasks.data ?? []) {
    if (!t.due_date) continue;
    if (t.status === "cancelled") continue;
    events.push({
      id: `task-${t.id}`,
      kind: "task",
      label: t.title,
      date: t.due_date,
      color: PRIO_COLOR[t.priority] ?? "#3B7BF5",
      href: "/dashboard/taches",
      meta: t.status === "done" ? "Terminée" : null,
    });
  }

  for (const inv of invoices.data ?? []) {
    if (!inv.due_date) continue;
    if (inv.status === "annulee" || inv.status === "payee") continue;
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = inv.due_date < today && inv.status === "envoyee";
    events.push({
      id: `invoice-${inv.id}`,
      kind: "invoice",
      label: inv.number,
      date: inv.due_date,
      color: isOverdue ? "#EF4444" : "#3B7BF5",
      href: `/dashboard/facturation/${inv.id}`,
      meta: new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(Number(inv.total) || 0),
    });
  }

  return events;
}
