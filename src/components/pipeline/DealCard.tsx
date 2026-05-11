"use client";
import React, { useTransition } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Building2, User, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  STAGES,
  getPriority,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  getStage,
} from "./stages";
import { updateDealStage } from "@/lib/actions/deals";
import type { DealStage, DealWithRelations } from "@/types";

interface DealCardProps {
  deal: DealWithRelations;
  onOpen: (deal: DealWithRelations) => void;
  /** Pour le DragOverlay : rend la card sans le hook sortable */
  overlay?: boolean;
  /** Mode mobile : pas de drag handle, affiche un select de stage */
  mobile?: boolean;
  /** Callback appelé après changement de stage (mode mobile) */
  onStageChanged?: (newStage: DealStage) => void;
}

export function DealCard({
  deal,
  onOpen,
  overlay = false,
  mobile = false,
  onStageChanged,
}: DealCardProps) {
  const sortable = useSortable({
    id: deal.id,
    data: { type: "deal", stage: deal.stage },
    disabled: overlay || mobile,
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const style: React.CSSProperties = overlay || mobile
    ? {}
    : {
        transform: CSS.Translate.toString(transform),
        transition,
      };

  const priority = getPriority(deal.expected_close_date);
  const stageDef = getStage(deal.stage);
  const accentBorder = stageDef.accent;
  const contactName = deal.contact
    ? `${deal.contact.first_name} ${deal.contact.last_name}`
    : null;
  const companyName = deal.company?.name ?? null;

  const [stagePending, startStageTransition] = useTransition();

  function handleStageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const newStage = e.target.value as DealStage;
    if (newStage === deal.stage) return;
    startStageTransition(async () => {
      const res = await updateDealStage(deal.id, newStage);
      if (!res.success) {
        toast.error("Impossible de changer le stage");
        return;
      }
      onStageChanged?.(newStage);
    });
  }

  return (
    <div
      ref={overlay || mobile ? undefined : setNodeRef}
      style={style}
      className={cn(
        "group relative bg-[#1C2A44] border border-[var(--border)] border-l-2 p-3 cursor-pointer transition-all",
        "hover:border-accent/30 hover:shadow-card-hover",
        isDragging && !overlay && "opacity-40",
        overlay && "shadow-card-hover ring-1 ring-accent/40 cursor-grabbing"
      )}
      data-stage={deal.stage}
      onClick={() => !isDragging && onOpen(deal)}
    >
      {/* Border-left coloré */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[2px]"
        style={{ background: accentBorder }}
      />

      <div className="flex items-start gap-2">
        {/* Drag handle — caché en mobile */}
        {!mobile && (
          <button
            type="button"
            aria-label="Déplacer"
            className={cn(
              "shrink-0 mt-0.5 -ml-1 text-muted-foreground/60 hover:text-foreground",
              "cursor-grab active:cursor-grabbing transition-colors",
              "opacity-50 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          {/* Titre + indicateur priorité */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
              {deal.title}
            </p>
            {priority && (
              <span
                title={`Clôture ${PRIORITY_LABEL[priority]}`}
                className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full"
                style={{ background: PRIORITY_COLOR[priority] }}
              />
            )}
          </div>

          {/* Contact / entreprise */}
          {(contactName || companyName) && (
            <div className="space-y-0.5">
              {contactName && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {contactName}
                </p>
              )}
              {companyName && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {companyName}
                </p>
              )}
            </div>
          )}

          {/* Footer : valeur + date */}
          <div className="flex items-end justify-between gap-2 pt-1">
            <div>
              {deal.value != null ? (
                <p
                  className="font-mono font-semibold text-white tabular-nums"
                  style={{ fontSize: 18, lineHeight: 1 }}
                >
                  {formatCurrency(deal.value)}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">—</p>
              )}
            </div>
            {deal.expected_close_date && (
              <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap">
                <Calendar className="h-2.5 w-2.5" />
                {formatDate(deal.expected_close_date)}
              </p>
            )}
          </div>

          {/* Mobile : select de stage */}
          {mobile && (
            <div
              className="pt-2 border-t border-[var(--border)]/50"
              onClick={(e) => e.stopPropagation()}
            >
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="shrink-0">Stage :</span>
                <select
                  value={deal.stage}
                  onChange={handleStageChange}
                  onClick={(e) => e.stopPropagation()}
                  disabled={stagePending}
                  className="flex-1 h-7 px-1.5 text-[11px] bg-[var(--background)] border border-[var(--border)] text-foreground focus:outline-none focus:border-accent"
                >
                  {STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {stagePending && <Loader2 className="h-3 w-3 animate-spin" />}
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
