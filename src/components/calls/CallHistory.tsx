"use client";

import React, { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatRelativeDate } from "@/lib/utils";
import { usePermission, useCurrentUserId } from "@/hooks/use-permission";
import {
  REACHABILITY_COLORS,
  RESULT_COLORS,
  getReachabilityLabel,
  getResultLabel,
  isResult,
} from "@/lib/call-outcomes";
import { deleteCallLog, type CallLogRow } from "@/lib/actions/calls";

interface Props {
  items: CallLogRow[];
  onDeleted: (id: string) => void;
}

export function CallHistory({ items, onDeleted }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Aucun appel enregistré pour l&apos;instant.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {items.map((it) => (
        <CallRow key={it.id} item={it} onDeleted={onDeleted} />
      ))}
    </ol>
  );
}

function CallRow({
  item,
  onDeleted,
}: {
  item: CallLogRow;
  onDeleted: (id: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const currentUserId = useCurrentUserId();
  const canDeleteAny = usePermission("calls.delete");
  const canDelete = canDeleteAny || item.rep_id === currentUserId;

  const reach = item.reachability as keyof typeof REACHABILITY_COLORS;
  const dotColor = REACHABILITY_COLORS[reach] ?? "var(--muted-foreground)";
  const result = item.result;
  const resultColor =
    result && isResult(result) ? RESULT_COLORS[result] : null;
  const repName = item.rep?.full_name ?? "—";

  function handleDelete() {
    if (pending) return;
    if (
      !confirm(
        `Supprimer cet appel ?\n\n${getReachabilityLabel(item.reachability)}`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteCallLog(item.id);
      if (!res.success) {
        toast.error(res.error, { id: `call-${item.id}` });
        return;
      }
      toast.success("Appel supprimé.", { id: `call-${item.id}` });
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
        style={{ backgroundColor: dotColor }}
        title={getReachabilityLabel(item.reachability)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-foreground">
            {getReachabilityLabel(item.reachability)}
          </p>
          {resultColor && (
            <span
              className="text-[10px] font-medium uppercase tracking-wide font-mono"
              style={{ color: resultColor }}
            >
              {getResultLabel(result)}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
            {item.notes}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {repName} · {formatRelativeDate(item.called_at)}
        </p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          aria-label="Supprimer cet appel"
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
