"use client";

import React, { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  REACHABILITY,
  RESULTS,
  RESULT_COLORS,
  REACHABILITY_KEYS,
  RESULT_KEYS,
  ANSWERED,
  type CallEntityType,
  type CallReachability,
  type CallResult,
} from "@/lib/call-outcomes";
import { createCallLog, type CallLogRow } from "@/lib/actions/calls";

interface Props {
  entityType: CallEntityType;
  entityId: string;
  /** Appelé après un log réussi avec la ligne insérée (rep joint). */
  onLogged?: (row: CallLogRow) => void;
}

export function CallLogger({ entityType, entityId, onLogged }: Props) {
  const [reachability, setReachability] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [pending, startTransition] = useTransition();
  // Quel bouton est en cours d'envoi (result key, ou "none" pour sans-réponse).
  const [pendingKey, setPendingKey] = useState<CallResult | "none" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answered = reachability === ANSWERED;

  function submit(result: CallResult | null) {
    if (!reachability) {
      setError("Choisissez d'abord la joignabilité.");
      return;
    }
    setError(null);
    setPendingKey(result ?? "none");
    startTransition(async () => {
      const res = await createCallLog({
        reachability: reachability as CallReachability,
        result,
        notes: notes || null,
        entity_type: entityType,
        entity_id: entityId,
      });
      setPendingKey(null);
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Appel enregistré.");
      setReachability("");
      setNotes("");
      onLogged?.(res.data);
    });
  }

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
          Joignabilité
        </Label>
        <Select value={reachability} onValueChange={setReachability}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Issue de l'appel…" />
          </SelectTrigger>
          <SelectContent>
            {REACHABILITY_KEYS.map((k) => (
              <SelectItem key={k} value={k} className="text-xs">
                {REACHABILITY[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
          Note (optionnel)
        </Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Contexte court…"
          className="h-8 text-xs"
        />
      </div>

      {answered ? (
        // Appel décroché → on capture le résultat de l'échange.
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {RESULT_KEYS.map((r) => {
            const isThisPending = pending && pendingKey === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => submit(r)}
                disabled={pending}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 h-9 text-xs font-medium text-white transition-opacity",
                  "disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                )}
                style={{ backgroundColor: RESULT_COLORS[r] }}
              >
                {isThisPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {RESULTS[r]}
              </button>
            );
          })}
        </div>
      ) : (
        // Pas décroché (ou rien sélectionné) → enregistrement direct sans résultat.
        <button
          type="button"
          onClick={() => submit(null)}
          disabled={pending || !reachability}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 h-9 text-xs font-medium transition-colors",
            "border border-[var(--border)] bg-[var(--surface)] text-foreground hover:border-[var(--muted)]",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {pending && pendingKey === "none" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          Enregistrer l&apos;appel
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
