"use client";

import React, { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  OUTCOMES,
  OUTCOME_COLORS,
  objectionsByStage,
  type ObjectionEntityType,
  type ObjectionOutcome,
} from "@/lib/objections";
import {
  createObjectionLog,
  type ObjectionLogRow,
} from "@/lib/actions/objections";

const GROUPS = objectionsByStage();
const OUTCOME_KEYS = Object.keys(OUTCOMES) as ObjectionOutcome[];

interface Props {
  entityType: ObjectionEntityType;
  entityId: string;
  /** Pré-remplissage du champ pain_id (detectPainId(rawPayload)). */
  defaultPainId?: string | null;
  /** Appelé après un log réussi avec la ligne insérée (rep joint). */
  onLogged?: (row: ObjectionLogRow) => void;
  /** Compacte le rendu (utilisé dans la Trame). */
  compact?: boolean;
}

export function ObjectionLogger({
  entityType,
  entityId,
  defaultPainId,
  onLogged,
  compact = false,
}: Props) {
  const [objectionId, setObjectionId] = useState<string>("");
  const [painId, setPainId] = useState<string>(defaultPainId ?? "");
  const [notes, setNotes] = useState<string>("");
  const [pendingOutcome, setPendingOutcome] = useState<ObjectionOutcome | null>(
    null
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(outcome: ObjectionOutcome) {
    if (!objectionId) {
      setError("Choisissez d'abord une objection.");
      return;
    }
    setError(null);
    setPendingOutcome(outcome);
    startTransition(async () => {
      const res = await createObjectionLog({
        objection_id: objectionId,
        outcome,
        pain_id: painId || null,
        notes: notes || null,
        entity_type: entityType,
        entity_id: entityId,
      });
      setPendingOutcome(null);
      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Objection enregistrée.");
      // Reset (on garde le pain_id : souvent constant sur un même lead).
      setObjectionId("");
      setNotes("");
      onLogged?.(res.data);
    });
  }

  return (
    <div className={cn("space-y-2.5", compact && "space-y-2")}>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
          Objection rencontrée
        </Label>
        <Select value={objectionId} onValueChange={setObjectionId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Choisir une objection…" />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((g) => (
              <SelectGroup key={g.stage}>
                <SelectLabel className="font-mono uppercase tracking-wide text-[10px]">
                  {g.label}
                </SelectLabel>
                {g.items.map((it) => (
                  <SelectItem key={it.id} value={it.id} className="text-xs">
                    {it.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
            Pain (optionnel)
          </Label>
          <Input
            value={painId}
            onChange={(e) => setPainId(e.target.value)}
            placeholder="ex. no_website"
            className="h-8 text-xs"
          />
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
      </div>

      {/* 3 boutons d'issue — chaque clic enregistre avec cet outcome. */}
      <div className="grid grid-cols-3 gap-2 pt-0.5">
        {OUTCOME_KEYS.map((o) => {
          const color = OUTCOME_COLORS[o];
          const isThisPending = pending && pendingOutcome === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => submit(o)}
              disabled={pending || !objectionId}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 h-9 text-xs font-medium text-white transition-opacity",
                "disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
              )}
              style={{ backgroundColor: color }}
            >
              {isThisPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {OUTCOMES[o]}
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
