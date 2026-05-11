"use client";
import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Phone,
  Calendar,
  Mail,
  Loader2,
  Plus,
  ArrowRight,
  CheckCircle2,
  FileText,
  FolderKanban,
  Kanban,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { createActivity, deleteActivity } from "@/lib/actions/activities";
import { formatRelativeDate, cn } from "@/lib/utils";
import type { Activity, ActivityEntityType } from "@/types";

const MANUAL_TYPES = ["note", "call", "meeting", "email"] as const;
type ManualType = (typeof MANUAL_TYPES)[number];

const MANUAL_LABELS: Record<ManualType, string> = {
  note: "Note",
  call: "Appel",
  meeting: "Rendez-vous",
  email: "Email",
};

const MANUAL_ICON: Record<ManualType, React.ComponentType<{ className?: string }>> = {
  note: MessageSquare,
  call: Phone,
  meeting: Calendar,
  email: Mail,
};

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  qualified: "Qualifié",
  proposal: "Devis",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  en_pause: "En pause",
  termine: "Terminé",
  annule: "Annulé",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  en_retard: "En retard",
  annulee: "Annulée",
};

type ActivityRow = Activity & {
  author?: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

interface Props {
  entityType: ActivityEntityType;
  entityId: string;
  initialActivities: ActivityRow[];
}

export function ActivityTimeline({
  entityType,
  entityId,
  initialActivities,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<ManualType>("note");
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createActivity({
        type,
        entity_type: entityType,
        entity_id: entityId,
        payload: { body: body.trim() },
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
          Historique
        </h2>
      </div>

      <form onSubmit={submit} className="space-y-2">
        <div className="flex gap-2">
          <Select value={type} onValueChange={(v) => setType(v as ManualType)}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_TYPES.map((t) => {
                const Icon = MANUAL_ICON[t];
                return (
                  <SelectItem key={t} value={t}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3 w-3" />
                      {MANUAL_LABELS[t]}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <div className="flex-1" />
        </div>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            type === "note"
              ? "Note interne, contexte, point d'avancement…"
              : type === "call"
              ? "Compte-rendu de l'appel"
              : type === "meeting"
              ? "Compte-rendu du rendez-vous"
              : "Résumé de l'email"
          }
          rows={3}
          className="text-sm"
        />
        <div className="flex items-center justify-end gap-2">
          {error && (
            <p className="text-xs text-destructive flex-1">{error}</p>
          )}
          <Button size="sm" type="submit" disabled={pending || !body.trim()}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </Button>
        </div>
      </form>

      {initialActivities.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Aucune activité pour l&apos;instant.
        </p>
      ) : (
        <ol className="space-y-3">
          {initialActivities.map((a) => (
            <ActivityItem key={a.id} activity={a} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function ActivityItem({ activity }: { activity: ActivityRow }) {
  const router = useRouter();
  const { icon: Icon, color, label, body } = renderActivity(activity);
  const author = activity.author?.full_name ?? "Système";
  const [deletePending, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (deletePending) return;
    const preview = body ? `${label} : ${body.slice(0, 60)}` : label;
    if (!confirm(`Supprimer cette activité ?\n\n${preview}`)) return;

    startDeleteTransition(async () => {
      const res = await deleteActivity(activity.id);
      if (!res.success) {
        toast.error(res.error, { id: `activity-${activity.id}` });
        return;
      }
      toast.success("Activité supprimée.", { id: `activity-${activity.id}` });
      router.refresh();
    });
  }

  return (
    <li className={cn("flex gap-3 group", deletePending && "opacity-60")}>
      <div
        className={cn(
          "h-7 w-7 shrink-0 flex items-center justify-center rounded-sm",
          color
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-foreground">{label}</p>
          <span className="text-[11px] text-muted-foreground">
            · {author} · {formatRelativeDate(activity.created_at)}
          </span>
        </div>
        {body && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
            {body}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deletePending}
        aria-label="Supprimer cette activité"
        className={cn(
          "h-6 w-6 shrink-0 flex items-center justify-center rounded-sm",
          "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive",
          "disabled:cursor-not-allowed"
        )}
      >
        {deletePending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Trash2 className="h-3 w-3" />
        )}
      </button>
    </li>
  );
}

function renderActivity(activity: ActivityRow) {
  const t = activity.type;
  const p = (activity.payload ?? {}) as Record<string, unknown>;

  if (t === "note" || t === "call" || t === "meeting" || t === "email") {
    return {
      icon: MANUAL_ICON[t as ManualType],
      color: "bg-accent/15 text-accent",
      label: MANUAL_LABELS[t as ManualType],
      body: typeof p.body === "string" ? p.body : null,
    };
  }
  if (t === "deal_created") {
    return {
      icon: Kanban,
      color: "bg-[#6366F1]/15 text-[#818CF8]",
      label: `Deal créé : ${p.title ?? ""}`,
      body: null as string | null,
    };
  }
  if (t === "deal_stage_changed") {
    return {
      icon: ArrowRight,
      color: "bg-[#6366F1]/15 text-[#818CF8]",
      label: `Étape : ${STAGE_LABELS[p.from as string] ?? p.from} → ${
        STAGE_LABELS[p.to as string] ?? p.to
      }`,
      body: null,
    };
  }
  if (t === "invoice_created") {
    return {
      icon: FileText,
      color: "bg-[#3B82F6]/15 text-[#60A5FA]",
      label: `${p.type === "quote" ? "Devis" : "Facture"} créé : ${p.number ?? ""}`,
      body: null,
    };
  }
  if (t === "invoice_status_changed") {
    return {
      icon: CheckCircle2,
      color: "bg-[#3B82F6]/15 text-[#60A5FA]",
      label: `Statut : ${INVOICE_STATUS_LABELS[p.from as string] ?? p.from} → ${
        INVOICE_STATUS_LABELS[p.to as string] ?? p.to
      }`,
      body: null,
    };
  }
  if (t === "project_created") {
    return {
      icon: FolderKanban,
      color: "bg-[#22C55E]/15 text-[#4ADE80]",
      label: `Projet créé : ${p.name ?? ""}`,
      body: null,
    };
  }
  if (t === "project_status_changed") {
    return {
      icon: ArrowRight,
      color: "bg-[#22C55E]/15 text-[#4ADE80]",
      label: `Statut : ${PROJECT_STATUS_LABELS[p.from as string] ?? p.from} → ${
        PROJECT_STATUS_LABELS[p.to as string] ?? p.to
      }`,
      body: null,
    };
  }

  return {
    icon: MessageSquare,
    color: "bg-[var(--muted)] text-muted-foreground",
    label: t,
    body: null as string | null,
  };
}
