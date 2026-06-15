"use client";

import React, { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelativeDate } from "@/lib/utils";
import { usePermission, useCurrentUserId } from "@/hooks/use-permission";
import { OUTCOMES, OUTCOME_COLORS, objectionLabel } from "@/lib/objections";
import {
  deleteObjectionLog,
  type ObjectionLogRow,
} from "@/lib/actions/objections";

interface Props {
  items: ObjectionLogRow[];
  onDeleted: (id: string) => void;
}

export function ObjectionHistory({ items, onDeleted }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Aucune objection loggée pour l&apos;instant.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {items.map((it) => (
        <ObjectionRow key={it.id} item={it} onDeleted={onDeleted} />
      ))}
    </ol>
  );
}

function ObjectionRow({
  item,
  onDeleted,
}: {
  item: ObjectionLogRow;
  onDeleted: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const currentUserId = useCurrentUserId();
  const canDeleteAny = usePermission("objections.delete");
  const canDelete = canDeleteAny || item.rep_id === currentUserId;

  const outcome = item.outcome as keyof typeof OUTCOMES | null;
  const color = outcome ? OUTCOME_COLORS[outcome] : "var(--muted-foreground)";
  const repName = item.rep?.full_name ?? "—";

  function handleDelete() {
    if (pending) return;
    if (!confirm(`Supprimer cette objection ?\n\n${objectionLabel(item.objection_id)}`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteObjectionLog(item.id);
      if (!res.success) {
        toast.error(res.error, { id: `objection-${item.id}` });
        return;
      }
      toast.success("Objection supprimée.", { id: `objection-${item.id}` });
      onDeleted(item.id);
    });
  }

  return (
    <li
      className={cn(
        "group flex items-start gap-2.5 px-2.5 py-2 border border-[var(--border)] bg-[var(--surface)]",
        pending && "opacity-60"
      )}
    >
      <span
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        title={outcome ? OUTCOMES[outcome] : "—"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-foreground">
            {objectionLabel(item.objection_id)}
          </p>
          {outcome && (
            <span
              className="text-[10px] font-medium uppercase tracking-wide font-mono"
              style={{ color }}
            >
              {OUTCOMES[outcome]}
            </span>
          )}
          {item.pain_id && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--muted)] text-muted-foreground">
              {item.pain_id}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
            {item.notes}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {repName} · {formatRelativeDate(item.created_at)}
        </p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Supprimer cette objection"
          className={cn(
            "h-6 w-6 shrink-0 flex items-center justify-center",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            "transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive",
            "disabled:cursor-not-allowed"
          )}
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </button>
      )}
    </li>
  );
}
