"use client";
import React, { useTransition } from "react";
import { toast } from "sonner";
import {
  UserCheck,
  CheckSquare,
  ArrowRight,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  dismissLeadsBatch,
  qualifyLeadsBatch,
  assignLeadsBatch,
  convertLeadsToDealsBatch,
} from "@/lib/actions/leads";
import type { LeadAssignee } from "@/lib/actions/leads";
import type { DealStage } from "@/types";

/**
 * Barre flottante sticky bottom-centrée affichée dès qu'il y a ≥1 lead
 * sélectionné dans le kanban. Propose les 4 actions batch + un bouton
 * d'annulation qui clear la sélection.
 *
 * Les server actions renvoient un BatchResult {ok, failed, errors} ; on
 * affiche un toast récapitulatif et on laisse PipelineClient gérer le
 * router.refresh() via `onDone`.
 */
export function BulkActionBar({
  selectedIds,
  profiles,
  onClear,
  onDone,
}: {
  selectedIds: string[];
  profiles: LeadAssignee[];
  onClear: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const count = selectedIds.length;
  if (count === 0) return null;

  function runAndReport(
    label: string,
    fn: () => Promise<{ ok: number; failed: number; errors: string[] }>
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.failed === 0) {
        toast.success(`${res.ok} lead${res.ok > 1 ? "s" : ""} · ${label}`);
      } else if (res.ok === 0) {
        toast.error(
          `Échec : ${res.errors[0] ?? "erreur inconnue"} (${res.failed})`
        );
      } else {
        toast.warning(
          `${res.ok} OK · ${res.failed} échec${res.failed > 1 ? "s" : ""}`
        );
      }
      onClear();
      onDone();
    });
  }

  function handleDismiss() {
    if (
      !window.confirm(
        `Rejeter ${count} lead${count > 1 ? "s" : ""} ? Ils resteront en base mais sortiront du pipeline.`
      )
    )
      return;
    runAndReport("rejeté(s)", () => dismissLeadsBatch(selectedIds));
  }

  function handleQualify() {
    runAndReport("qualifié(s)", () => qualifyLeadsBatch(selectedIds));
  }

  function handleAssign(assigneeId: string | null) {
    const who = assigneeId
      ? profiles.find((p) => p.id === assigneeId)?.full_name ?? "membre"
      : "personne (désassigné)";
    runAndReport(`assigné(s) à ${who}`, () =>
      assignLeadsBatch(selectedIds, assigneeId)
    );
  }

  function handleConvertToDeal(stage: DealStage) {
    if (
      !window.confirm(
        `Convertir ${count} lead${count > 1 ? "s" : ""} en deal "${stage}" ?`
      )
    )
      return;
    runAndReport("converti(s) en deal", () =>
      convertLeadsToDealsBatch(selectedIds, stage)
    );
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[90vw]">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] shadow-card-hover rounded-md">
        <span className="text-xs font-medium text-foreground mr-2">
          {count} sélectionné{count > 1 ? "s" : ""}
        </span>

        {/* Assigner */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              disabled={pending}
            >
              <UserCheck className="h-3.5 w-3.5" />
              Assigner
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {profiles.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => handleAssign(p.id)}
              >
                {p.full_name ?? p.email ?? p.id}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onSelect={() => handleAssign(null)}
              className="text-muted-foreground"
            >
              Désassigner
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Qualifier */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={handleQualify}
          disabled={pending}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          Qualifier
        </Button>

        {/* Convertir en deal — choix du stage cible */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              disabled={pending}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Convertir
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => handleConvertToDeal("discussion")}>
              Stage : Discussion
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleConvertToDeal("proposal")}>
              Stage : Devis
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleConvertToDeal("negotiation")}>
              Stage : Négociation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Rejeter */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
          onClick={handleDismiss}
          disabled={pending}
        >
          <X className="h-3.5 w-3.5" />
          Rejeter
        </Button>

        <span className="mx-1 h-4 w-px bg-[var(--border)]" />

        {/* Annuler la sélection */}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onClear}
          disabled={pending}
        >
          Annuler
        </Button>

        {pending && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
