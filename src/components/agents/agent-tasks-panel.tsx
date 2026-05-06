"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Ban,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cancelTask } from "@/lib/actions/agent-tasks";
import { formatRelativeDate, cn } from "@/lib/utils";
import type { AgentTask, AgentTaskEntityType } from "@/types";

interface Props {
  entityType: AgentTaskEntityType;
  entityId: string;
  initialTasks: AgentTask[];
}

const AGENT_LABELS: Record<string, string> = {
  "premier-contact": "Kit premier contact",
  enrichissement: "Enrichissement",
  "audit-site": "Audit du site",
  "rescoring-deal": "Re-scoring du deal",
};

const STATUS_META: Record<
  AgentTask["status"],
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
  }
> = {
  pending: {
    label: "En file d'attente",
    icon: Clock,
    color: "text-[#F59E0B]",
    bg: "bg-[#F59E0B]/10 border-[#F59E0B]/30",
  },
  running: {
    label: "En cours",
    icon: Loader2,
    color: "text-accent",
    bg: "bg-accent/10 border-accent/30",
  },
  done: {
    label: "Terminé",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10 border-success/30",
  },
  error: {
    label: "Erreur",
    icon: AlertTriangle,
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
  },
  cancelled: {
    label: "Annulé",
    icon: Ban,
    color: "text-muted-foreground",
    bg: "bg-[var(--muted)] border-[var(--border)]",
  },
};

export function AgentTasksPanel({ entityType, entityId, initialTasks }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState<AgentTask[]>(initialTasks);

  // Realtime: subscribe to changes on agent_tasks for this entity
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`agent_tasks:${entityType}:${entityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_tasks",
          filter: `entity_id=eq.${entityId}`,
        },
        (payload) => {
          const eventType = payload.eventType;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = (payload.new ?? payload.old) as any;
          if (row?.entity_type !== entityType) return;
          if (eventType === "INSERT") {
            setTasks((prev) =>
              [row as AgentTask, ...prev]
                .filter(
                  (t, i, arr) => arr.findIndex((x) => x.id === t.id) === i
                )
                .slice(0, 10)
            );
          } else if (eventType === "UPDATE") {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === row.id ? (row as AgentTask) : t
              )
            );
            // Si une tâche vient de passer "done", on rafraîchit la page
            // pour voir les activities/contacts/etc. nouvellement insérés
            if (row.status === "done") {
              router.refresh();
            }
          } else if (eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== row.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId, router]);

  const handleCancel = useCallback(async (taskId: string) => {
    const res = await cancelTask(taskId);
    if (res.success) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "cancelled" as const }
            : t
        )
      );
    }
  }, []);

  if (tasks.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
          Tâches IA
        </h2>
      </div>

      <ul className="space-y-2">
        {tasks.map((t) => {
          const meta = STATUS_META[t.status];
          const Icon = meta.icon;
          const agentLabel = AGENT_LABELS[t.agent] ?? t.agent;
          return (
            <li
              key={t.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 border text-xs",
                meta.bg
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  meta.color,
                  t.status === "running" && "animate-spin"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{agentLabel}</p>
                <p className={cn("text-[11px]", meta.color)}>
                  {meta.label}
                  {" · "}
                  <span className="text-muted-foreground">
                    {formatRelativeDate(t.created_at)}
                  </span>
                </p>
                {t.status === "error" && t.error && (
                  <p className="text-[11px] text-destructive mt-0.5 truncate">
                    {t.error}
                  </p>
                )}
              </div>
              {t.status === "pending" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleCancel(t.id)}
                  title="Annuler"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[10px] text-muted-foreground">
        Les tâches en file d&apos;attente sont traitées quand tu lances
        l&apos;agent correspondant dans multica.
      </p>
    </Card>
  );
}
