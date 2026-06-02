"use client";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Flame,
  CalendarDays,
  Bell,
  BellOff,
} from "lucide-react";
import { useBrowserNotifications } from "@/hooks/use-browser-notifications";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActions } from "@/components/ui/row-actions";
import { TaskDrawer } from "@/components/tasks/TaskDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { deleteTask, updateTaskStatus } from "@/lib/actions/tasks";
import { getProjectColor } from "@/lib/project-color";
import { formatDate, cn } from "@/lib/utils";
import { taskStatuses, taskPriorities } from "@/lib/statuses";
import type { Task, TaskStatus } from "@/types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: taskStatuses.pending.label,
  in_progress: taskStatuses.in_progress.label,
  done: taskStatuses.done.label,
  cancelled: taskStatuses.cancelled.label,
};

const STATUS_VARIANT: Record<
  TaskStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  pending: taskStatuses.pending.variant,
  in_progress: taskStatuses.in_progress.variant,
  done: taskStatuses.done.variant,
  cancelled: taskStatuses.cancelled.variant,
};

const PRIORITY_META = taskPriorities;

const FILTER_OPTIONS: { key: "all" | "mine" | "overdue" | "this_week"; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "mine", label: "Mes tâches" },
  { key: "overdue", label: "En retard" },
  { key: "this_week", label: "Cette semaine" },
];

const STATUS_FILTERS: { key: "all" | TaskStatus; label: string }[] = [
  { key: "all", label: "Tout statut" },
  { key: "pending", label: "À faire" },
  { key: "in_progress", label: "En cours" },
  { key: "done", label: "Terminée" },
];

type TaskRow = Task & {
  assignee?: { id: string; full_name: string | null } | null;
  relatedProject?: { id: string; name: string } | null;
};

interface Props {
  initialTasks: TaskRow[];
  members: { id: string; full_name: string | null; email: string | null }[];
  currentUserId: string | null;
}

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function endOfWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()));
  return d.toISOString().split("T")[0];
}

export function TasksClient({ initialTasks, members, currentUserId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "mine" | "overdue" | "this_week">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);
  const [, startTransition] = useTransition();

  const today = startOfTodayISO();
  const weekEnd = endOfWeekISO();

  // Notification browser pour tâches dues aujourd'hui (une notif/jour max,
  // n'apparait que si l'app n'est pas focus — comportement du hook).
  const { permission, requestPermission, notify } = useBrowserNotifications();
  const dueTodayPendingCount = useMemo(
    () =>
      initialTasks.filter(
        (t) =>
          t.due_date === today &&
          (t.status === "pending" || t.status === "in_progress")
      ).length,
    [initialTasks, today]
  );
  useEffect(() => {
    if (permission !== "granted" || dueTodayPendingCount === 0) return;
    if (typeof window === "undefined") return;
    const lastKey = "norva.tasks.lastNotifyDate";
    if (window.localStorage.getItem(lastKey) === today) return;
    notify(
      `${dueTodayPendingCount} tâche${
        dueTodayPendingCount > 1 ? "s" : ""
      } due${dueTodayPendingCount > 1 ? "s" : ""} aujourd'hui`,
      {
        body: "Ouvre Norva CRM pour les traiter.",
        onClick: () => {
          window.location.href = "/dashboard/taches";
        },
      }
    );
    window.localStorage.setItem(lastKey, today);
  }, [permission, dueTodayPendingCount, notify, today]);

  // Liste des projets visibles parmi les tâches (pour le dropdown filtre)
  const availableProjects = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of initialTasks) {
      if (t.relatedProject) m.set(t.relatedProject.id, t.relatedProject.name);
    }
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [initialTasks]);

  const stats = useMemo(() => {
    const open = initialTasks.filter(
      (t) => t.status === "pending" || t.status === "in_progress"
    );
    const overdue = open.filter(
      (t) => t.due_date && t.due_date < today
    ).length;
    const dueThisWeek = open.filter(
      (t) => t.due_date && t.due_date >= today && t.due_date <= weekEnd
    ).length;
    const mine = open.filter((t) => t.assigned_to === currentUserId).length;
    return { open: open.length, overdue, dueThisWeek, mine };
  }, [initialTasks, today, weekEnd, currentUserId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialTasks.filter((t) => {
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;

      const matchesProject =
        projectFilter === "all" ||
        (projectFilter === "none" && !t.relatedProject) ||
        t.relatedProject?.id === projectFilter;

      let matchesView = true;
      if (view === "mine") {
        matchesView = t.assigned_to === currentUserId;
      } else if (view === "overdue") {
        matchesView =
          !!t.due_date &&
          t.due_date < today &&
          t.status !== "done" &&
          t.status !== "cancelled";
      } else if (view === "this_week") {
        matchesView =
          !!t.due_date && t.due_date >= today && t.due_date <= weekEnd;
      }

      return matchesSearch && matchesStatus && matchesProject && matchesView;
    });
  }, [
    initialTasks,
    search,
    statusFilter,
    projectFilter,
    view,
    today,
    weekEnd,
    currentUserId,
  ]);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(t: TaskRow) {
    setEditing(t);
    setDrawerOpen(true);
  }
  function handleDelete() {
    if (!deleting) return Promise.resolve({ success: true } as const);
    return deleteTask(deleting.id).then((res) => {
      if (res.success) {
        startTransition(() => router.refresh());
      }
      return res;
    });
  }
  function handleSuccess() {
    startTransition(() => router.refresh());
  }
  function toggleDone(t: TaskRow) {
    const next: TaskStatus = t.status === "done" ? "pending" : "done";
    startTransition(async () => {
      await updateTaskStatus(t.id, next);
      router.refresh();
    });
  }

  return (
    <>
      <Header
        title="Tâches"
        action={{ label: "Nouvelle tâche", onClick: openCreate }}
      />

      <div className="flex-1 p-4 md:p-6 animate-fade-in space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Ouvertes" value={stats.open} />
          <KPI label="Mes tâches" value={stats.mine} accent="#3B7BF5" />
          <KPI label="En retard" value={stats.overdue} accent="#EF4444" />
          <KPI label="Cette semaine" value={stats.dueThisWeek} accent="#F59E0B" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map((f) => (
              <button
                key={f.key}
                onClick={() => setView(f.key)}
                className={cn(
                  "text-xs px-2.5 py-1 transition-colors rounded-sm",
                  view === f.key
                    ? "bg-accent text-white"
                    : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
            <Link
              href="/dashboard/calendrier"
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors"
              title="Voir les tâches (et autres échéances) dans le calendrier"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendrier
            </Link>
            {permission === "default" && (
              <button
                type="button"
                onClick={requestPermission}
                title="Activer les notifications navigateur pour les tâches dues aujourd'hui"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-[var(--muted)] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bell className="h-3.5 w-3.5" />
                Activer notifs
              </button>
            )}
            {permission === "granted" && (
              <span
                title="Notifications activées — une alerte par jour si tâches dues"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-success/15 text-success"
              >
                <Bell className="h-3.5 w-3.5" />
                Notifs ON
              </span>
            )}
            {permission === "denied" && (
              <span
                title="Notifications bloquées par le navigateur — autorise-les dans les paramètres du site"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm bg-destructive/15 text-destructive"
              >
                <BellOff className="h-3.5 w-3.5" />
                Notifs bloquées
              </span>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "text-xs px-2.5 py-1 transition-colors rounded-sm",
                  statusFilter === f.key
                    ? "bg-accent text-white"
                    : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {availableProjects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-7 px-2 text-xs bg-[var(--surface)] border border-[var(--border)] text-foreground focus:outline-none focus:border-accent/40"
            >
              <option value="all">Tous les projets</option>
              <option value="none">Sans projet</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* List */}
        <Card className="overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Aucune tâche.{" "}
              <button
                onClick={openCreate}
                className="text-accent hover:underline"
              >
                Créer la première
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((t) => {
                const overdue =
                  !!t.due_date &&
                  t.due_date < today &&
                  t.status !== "done" &&
                  t.status !== "cancelled";
                const done = t.status === "done";
                const cancelled = t.status === "cancelled";
                const prio = PRIORITY_META[t.priority];
                const relatedHref = relatedHrefFor(t);
                return (
                  <li
                    key={t.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors",
                      cancelled && "opacity-50"
                    )}
                  >
                    <button
                      onClick={() => toggleDone(t)}
                      className="mt-0.5 shrink-0"
                      aria-label={done ? "Rouvrir" : "Marquer terminée"}
                    >
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 md:gap-3 flex-wrap">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          {t.relatedProject && (
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{
                                background: getProjectColor(t.relatedProject.id),
                              }}
                              aria-hidden
                              title={t.relatedProject.name}
                            />
                          )}
                          <p
                            className={cn(
                              "text-sm font-medium text-foreground truncate",
                              done && "line-through text-muted-foreground"
                            )}
                          >
                            {t.relatedProject ? (
                              <span className="text-muted-foreground font-normal">
                                [{t.relatedProject.name}]{" "}
                              </span>
                            ) : t.related_type === "project" ? (
                              // Tâche dont le projet a été supprimé : on garde
                              // la tâche, on indique qu'elle est orpheline
                              <span className="text-muted-foreground/70 italic font-normal text-[11px]">
                                (projet supprimé){" "}
                              </span>
                            ) : null}
                            {t.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {t.priority !== "normal" && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px]",
                                prio.color
                              )}
                              title={`Priorité ${prio.label.toLowerCase()}`}
                            >
                              {t.priority === "urgent" ? (
                                <Flame className="h-3 w-3" />
                              ) : t.priority === "high" ? (
                                <AlertCircle className="h-3 w-3" />
                              ) : null}
                              {prio.label}
                            </span>
                          )}
                          <Badge variant={STATUS_VARIANT[t.status]}>
                            {STATUS_LABELS[t.status]}
                          </Badge>
                        </div>
                      </div>

                      {t.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {t.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {t.due_date && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 text-[11px]",
                              overdue
                                ? "text-destructive"
                                : "text-muted-foreground"
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {formatDate(t.due_date)}
                          </span>
                        )}
                        {t.assignee?.full_name && (
                          <span className="text-[11px] text-muted-foreground">
                            👤 {t.assignee.full_name}
                          </span>
                        )}
                        {t.related_type === "project" ? (
                          t.relatedProject ? (
                            <Link
                              href={`/dashboard/projets/${t.relatedProject.id}`}
                              className="text-[11px] text-accent hover:underline"
                            >
                              ↗ {t.relatedProject.name}
                            </Link>
                          ) : null
                        ) : relatedHref && t.related_type ? (
                          <Link
                            href={relatedHref}
                            className="text-[11px] text-accent hover:underline"
                          >
                            ↗ {RELATED_LABEL[t.related_type]}
                          </Link>
                        ) : null}
                      </div>
                    </div>

                    <RowActions
                      onEdit={() => openEdit(t)}
                      onDelete={() => setDeleting(t)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <TaskDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        task={editing}
        members={members}
        onSuccess={handleSuccess}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="la tâche"
        itemName={deleting?.title ?? ""}
        onConfirm={handleDelete}
      />
    </>
  );
}

const RELATED_LABEL: Record<string, string> = {
  contact: "Contact",
  company: "Entreprise",
  deal: "Deal",
  project: "Projet",
};

function relatedHrefFor(t: Task): string | null {
  if (!t.related_type || !t.related_id) return null;
  switch (t.related_type) {
    case "contact":
      return `/dashboard/contacts/${t.related_id}`;
    case "company":
      return `/dashboard/companies/${t.related_id}`;
    case "project":
      return `/dashboard/projets/${t.related_id}`;
    case "deal":
      return `/dashboard/pipeline`;
    default:
      return null;
  }
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className="text-xl font-bold font-mono"
        style={accent ? { color: accent } : { color: "var(--foreground)" }}
      >
        {value}
      </p>
    </Card>
  );
}
