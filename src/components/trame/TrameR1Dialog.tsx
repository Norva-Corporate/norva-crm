"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  AlertTriangle,
  MessageSquareWarning,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ObjectionLogger } from "@/components/objections/ObjectionLogger";
import { createActivity } from "@/lib/actions/activities";
import type { ObjectionEntityType } from "@/lib/objections";
import {
  SECTEURS,
  SECTEUR_LABELS,
  PAIN_CONTENT,
  PAIN_LABELS,
  TRAME_PHASES,
  normalizeSector,
  normalizePain,
  interpolateSecteur,
  type SecteurKey,
  type PainKey,
  type TrameBlock,
} from "@/lib/trame-r1";

const NO_PAIN = "__none__";
const SECTEUR_KEYS = Object.keys(SECTEURS) as SecteurKey[];
const PAIN_KEYS = Object.keys(PAIN_CONTENT) as PainKey[];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ObjectionEntityType;
  entityId: string;
  companyName: string | null;
  rawPayload?: Record<string, unknown> | null;
}

export function TrameR1Dialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  companyName,
  rawPayload,
}: Props) {
  const detectedSector = useMemo<SecteurKey>(
    () =>
      normalizeSector(
        (rawPayload?.sector as unknown) ?? (rawPayload?.secteur as unknown)
      ),
    [rawPayload]
  );
  const detectedPain = useMemo<PainKey | null>(
    () => normalizePain(rawPayload),
    [rawPayload]
  );

  const [secteur, setSecteur] = useState<SecteurKey>(detectedSector);
  const [pain, setPain] = useState<PainKey | null>(detectedPain);
  const [openPhases, setOpenPhases] = useState<Set<number>>(() => new Set([1]));

  // Re-sync les pré-remplissages quand on ouvre la trame d'un autre lead.
  useEffect(() => {
    if (open) {
      setSecteur(detectedSector);
      setPain(detectedPain);
      setOpenPhases(new Set([1]));
    }
  }, [open, detectedSector, detectedPain]);

  function togglePhase(id: number) {
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100%-1.5rem)] p-0">
        <DialogHeader className="border-b border-[var(--border)]">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-accent" />
            Trame RDV 1 — {companyName || "Prospect"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Trame d&apos;audit / closing modulable. Le contenu ciblé s&apos;adapte
            au secteur et au pain.
          </p>

          {/* Contrôles secteur + pain */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                Secteur
              </Label>
              <Select
                value={secteur}
                onValueChange={(v) => setSecteur(v as SecteurKey)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTEUR_KEYS.map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {SECTEUR_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                Pain principal
              </Label>
              <Select
                value={pain ?? NO_PAIN}
                onValueChange={(v) =>
                  setPain(v === NO_PAIN ? null : (v as PainKey))
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PAIN} className="text-xs">
                    À définir
                  </SelectItem>
                  {PAIN_KEYS.map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {PAIN_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Accordéon des 7 phases */}
        <div className="px-4 md:px-6 pb-2 space-y-2">
          {TRAME_PHASES.map((phase) => {
            const isOpen = openPhases.has(phase.id);
            return (
              <div
                key={phase.id}
                className="border border-[var(--border)] bg-[var(--surface)]"
              >
                <button
                  type="button"
                  onClick={() => togglePhase(phase.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--muted)]/30 transition-colors"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-[10px] font-mono text-accent w-5 shrink-0">
                    {phase.id}
                  </span>
                  <span className="flex-1 text-sm font-medium text-foreground">
                    {phase.title}
                  </span>
                  {phase.timing && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {phase.timing}
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[var(--border)]">
                    {phase.blocks.map((block, i) => (
                      <BlockView
                        key={i}
                        block={block}
                        secteur={secteur}
                        pain={pain}
                        entityType={entityType}
                        entityId={entityId}
                        painIdForLogger={pain ?? undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Notes de RDV (optionnel) */}
        <TrameNotes entityType={entityType} entityId={entityId} />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Rendu d'un bloc de phase
// ============================================================
function BlockView({
  block,
  secteur,
  pain,
  entityType,
  entityId,
  painIdForLogger,
}: {
  block: TrameBlock;
  secteur: SecteurKey;
  pain: PainKey | null;
  entityType: ObjectionEntityType;
  entityId: string;
  painIdForLogger?: string;
}) {
  const [logOpen, setLogOpen] = useState(false);

  switch (block.kind) {
    case "text":
      return (
        <p className="text-sm text-foreground/90 leading-relaxed">
          {interpolateSecteur(block.text, secteur)}
        </p>
      );

    case "list":
      return (
        <div className="space-y-1.5">
          {block.title && (
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
              {block.title}
            </p>
          )}
          <ul className="space-y-1">
            {block.items.map((item, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-foreground/90 leading-relaxed"
              >
                <span className="text-accent shrink-0">·</span>
                <span>{interpolateSecteur(item, secteur)}</span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "pain": {
      if (!pain) {
        return (
          <div className="border-l-2 border-[var(--border)] pl-3 py-1">
            {block.intro && (
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono mb-1">
                {block.intro}
              </p>
            )}
            <p className="text-xs text-muted-foreground italic">
              Sélectionnez un pain principal pour afficher ce bloc ciblé.
            </p>
          </div>
        );
      }
      return (
        <div className="border-l-2 border-accent/40 pl-3 py-1 bg-accent/5">
          {block.intro && (
            <p className="text-[10px] uppercase tracking-wide text-accent font-mono mb-1">
              {block.intro}
            </p>
          )}
          <p className="text-sm text-foreground leading-relaxed">
            {PAIN_CONTENT[pain][block.slot]}
          </p>
        </div>
      );
    }

    case "callout": {
      const warn = block.tone === "warn";
      const Icon = warn ? AlertTriangle : Info;
      return (
        <div
          className={cn(
            "flex items-start gap-2 px-2.5 py-2 text-xs border",
            warn
              ? "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FCD34D]"
              : "border-accent/30 bg-accent/5 text-foreground/90"
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0 mt-0.5",
              warn ? "text-[#F59E0B]" : "text-accent"
            )}
          />
          <span>{interpolateSecteur(block.text, secteur)}</span>
        </div>
      );
    }

    case "logObjection":
      return (
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLogOpen((v) => !v)}
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
            {logOpen ? "Masquer" : "Logguer l'objection"}
          </Button>
          {logOpen && (
            <div className="mt-2 border border-[var(--border)] bg-[var(--card)] p-3">
              <ObjectionLogger
                entityType={entityType}
                entityId={entityId}
                defaultPainId={painIdForLogger}
                compact
                onLogged={() => setLogOpen(false)}
              />
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}

// ============================================================
// Notes de RDV → activity 'note' (optionnel)
// ============================================================
function TrameNotes({
  entityType,
  entityId,
}: {
  entityType: ObjectionEntityType;
  entityId: string;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await createActivity({
        type: "note",
        entity_type: entityType,
        entity_id: entityId,
        payload: { body: body.trim(), agent: "trame-r1" },
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Note de RDV enregistrée.");
      setBody("");
    });
  }

  return (
    <div className="border-t border-[var(--border)] p-4 md:p-6 space-y-2">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
        Notes de RDV (enregistrées dans l&apos;historique)
      </Label>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Points clés, décision, prochaine étape…"
        className="text-sm"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={save}
          disabled={pending || !body.trim()}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Enregistrer en note
        </Button>
      </div>
    </div>
  );
}
