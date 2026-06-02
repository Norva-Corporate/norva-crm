"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Target, Users, User, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RowActions } from "@/components/ui/row-actions";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { GoalDrawer } from "./GoalDrawer";
import {
  deleteGoal,
  archiveGoal,
  reactivateGoal,
  type GoalWithProgress,
} from "@/lib/actions/goals";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type View = "team" | "mine" | "all";

const METRIC_LABEL: Record<string, string> = {
  deals_won: "Deals gagnés",
  revenue_collected: "Revenu encaissé",
  leads_qualified: "Leads qualifiés",
};

function formatMetricValue(
  value: number,
  metric: string
): string {
  if (metric === "revenue_collected") return formatCurrency(value);
  return String(Math.round(value));
}

export function ObjectifsClient({
  initialGoals,
  profiles,
}: {
  initialGoals: GoalWithProgress[];
  profiles: { id: string; full_name: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<View>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<GoalWithProgress | null>(null);
  const [deleting, setDeleting] = useState<GoalWithProgress | null>(null);

  const activeGoals = useMemo(
    () => initialGoals.filter((g) => g.status === "active"),
    [initialGoals]
  );

  const stats = useMemo(() => {
    const total = activeGoals.length;
    const avgProgress =
      total > 0
        ? Math.round(
            activeGoals.reduce((s, g) => s + g.progress_pct, 0) / total
          )
        : 0;
    const atRisk = activeGoals.filter(
      (g) => !g.on_track && g.days_remaining > 0
    ).length;
    return { total, avgProgress, atRisk };
  }, [activeGoals]);

  const filtered = useMemo(() => {
    if (view === "team") return initialGoals.filter((g) => g.scope === "team");
    if (view === "mine")
      return initialGoals.filter((g) => g.scope === "individual");
    return initialGoals;
  }, [initialGoals, view]);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(g: GoalWithProgress) {
    setEditing(g);
    setDrawerOpen(true);
  }
  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleArchive(g: GoalWithProgress) {
    const fn = g.status === "archived" ? reactivateGoal : archiveGoal;
    const res = await fn(g.id);
    if (res.success) {
      toast.success(
        g.status === "archived" ? "Objectif réactivé." : "Objectif archivé."
      );
      refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleting)
      return Promise.resolve({ success: true } as const);
    return deleteGoal(deleting.id).then((res) => {
      if (res.success) {
        toast.success("Objectif supprimé.");
        refresh();
      } else {
        toast.error(res.error);
      }
      return res;
    });
  }

  return (
    <>
      <Header
        title="Objectifs"
        action={{ label: "Nouvel objectif", onClick: openCreate }}
      />

      <div className="flex-1 p-4 md:p-6 animate-fade-in space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KPICard
            icon={Target}
            label="Objectifs actifs"
            value={String(stats.total)}
          />
          <KPICard
            icon={Target}
            label="% moyen atteint"
            value={`${stats.avgProgress}%`}
            accent={
              stats.avgProgress >= 80
                ? "#22C55E"
                : stats.avgProgress >= 40
                ? "#F59E0B"
                : "#EF4444"
            }
          />
          <KPICard
            icon={AlertCircle}
            label="À risque"
            value={String(stats.atRisk)}
            accent={stats.atRisk > 0 ? "#EF4444" : undefined}
          />
        </div>

        {/* Tabs */}
        <div className="inline-flex border border-[var(--border)] bg-[var(--surface)] p-0.5">
          <TabButton
            active={view === "all"}
            onClick={() => setView("all")}
            label="Tous"
          />
          <TabButton
            active={view === "team"}
            onClick={() => setView("team")}
            icon={Users}
            label="Équipe"
          />
          <TabButton
            active={view === "mine"}
            onClick={() => setView("mine")}
            icon={User}
            label="Individuels"
          />
        </div>

        {/* Goals list */}
        {filtered.length === 0 ? (
          <Card className="px-4 py-16 text-center">
            <Target className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-2">
              Aucun objectif {view !== "all" ? `(${view === "team" ? "équipe" : "individuel"})` : ""}.
            </p>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              Créer un objectif
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={() => openEdit(g)}
                onArchive={() => handleArchive(g)}
                onDelete={() => setDeleting(g)}
              />
            ))}
          </div>
        )}
      </div>

      <GoalDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        goal={editing}
        profiles={profiles}
        onSuccess={refresh}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="l'objectif"
        itemName={deleting?.title ?? ""}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{label}</span>
        </div>
        <p
          className="text-2xl font-bold font-mono"
          style={
            accent ? { color: accent } : { color: "var(--foreground)" }
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 text-xs transition-colors inline-flex items-center gap-1.5",
        active
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}

function GoalCard({
  goal,
  onEdit,
  onArchive,
  onDelete,
}: {
  goal: GoalWithProgress;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const isArchived = goal.status === "archived";
  const progressColor =
    goal.progress_pct >= 100
      ? "#22C55E"
      : !goal.on_track && goal.days_remaining > 0
      ? "#EF4444"
      : goal.progress_pct >= 60
      ? "#22C55E"
      : "#F59E0B";

  return (
    <Card className={cn("p-4", isArchived && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{goal.title}</p>
            <Badge variant="default" className="text-[10px]">
              {goal.scope === "team" ? "Équipe" : goal.owner_name ?? "—"}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {METRIC_LABEL[goal.metric_type] ?? goal.metric_type}
            </Badge>
            {isArchived && (
              <Badge variant="secondary" className="text-[10px]">
                Archivé
              </Badge>
            )}
          </div>
          {goal.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {goal.description}
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-foreground">
                {formatMetricValue(goal.current_value, goal.metric_type)} /{" "}
                {formatMetricValue(goal.target_value, goal.metric_type)}
              </span>
              <span
                className="font-semibold"
                style={{ color: progressColor }}
              >
                {goal.progress_pct}%
              </span>
            </div>
            <div className="h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${goal.progress_pct}%`,
                  backgroundColor: progressColor,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="font-mono">
                {formatDate(goal.period_start)} → {formatDate(goal.period_end)}
              </span>
              <span>
                {goal.days_remaining > 0
                  ? `${goal.days_remaining}j restant${goal.days_remaining > 1 ? "s" : ""}`
                  : goal.days_remaining === 0
                  ? "Dernier jour"
                  : `Terminé il y a ${Math.abs(goal.days_remaining)}j`}
              </span>
            </div>
          </div>
        </div>

        <RowActions
          onEdit={onEdit}
          onDelete={onDelete}
          extra={
            <button
              type="button"
              onClick={onArchive}
              className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-[var(--muted)] cursor-pointer w-full text-left"
            >
              {isArchived ? "Réactiver" : "Archiver"}
            </button>
          }
        />
      </div>
    </Card>
  );
}
