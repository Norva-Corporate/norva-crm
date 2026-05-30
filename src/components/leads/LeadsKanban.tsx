"use client";
import React, { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragCancelEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { LeadCard } from "./LeadCard";
import { getLeadBoardColumnId, type LeadBoardColumn } from "./stages";
import { cn } from "@/lib/utils";
import {
  updateLeadStage,
  updateLeadStageAndAssignee,
} from "@/lib/actions/leads";
import { useIsMobile } from "@/hooks/use-media-query";
import type {
  LeadPipelineStage,
  LeadWithDedup,
} from "@/lib/actions/leads";

interface LeadsKanbanProps {
  leads: LeadWithDedup[];
  columns: LeadBoardColumn[];
  onLeadsChange: (
    updater: (prev: LeadWithDedup[]) => LeadWithDedup[]
  ) => void;
  onOpenLead: (lead: LeadWithDedup) => void;
}

export function LeadsKanban({
  leads,
  columns,
  onLeadsChange,
  onOpenLead,
}: LeadsKanbanProps) {
  const isMobile = useIsMobile();
  const [activeLead, setActiveLead] = useState<LeadWithDedup | null>(null);
  const snapshotRef = useRef<LeadWithDedup[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  /**
   * Bucket des leads par colonne. Pour `to_contact`, le bucket dépend de
   * `assigned_to`. Les leads `to_contact` orphelins (assigned_to=null ou
   * inconnu) sont rangés dans la 1re sous-colonne pour rester visibles —
   * un UPDATE one-shot a normalement déjà tidy les leads pré-existants.
   */
  const leadsByColumn = useMemo(() => {
    const acc: Record<string, LeadWithDedup[]> = {};
    for (const c of columns) acc[c.id] = [];
    const firstToContactColId =
      columns.find((c) => c.stage === "to_contact")?.id ?? null;

    for (const l of leads) {
      const colId = getLeadBoardColumnId(
        l.pipeline_stage,
        l.assigned_to,
        columns
      );
      if (colId && acc[colId]) {
        acc[colId].push(l);
      } else if (l.pipeline_stage === "to_contact" && firstToContactColId) {
        acc[firstToContactColId].push(l);
      }
    }
    return acc;
  }, [leads, columns]);

  const columnById = useMemo(() => {
    const m = new Map<string, LeadBoardColumn>();
    for (const c of columns) m.set(c.id, c);
    return m;
  }, [columns]);

  function findLead(id: string): LeadWithDedup | undefined {
    return leads.find((l) => l.id === id);
  }

  function handleDragStart(event: DragStartEvent) {
    const lead = findLead(String(event.active.id));
    if (lead) {
      setActiveLead(lead);
      snapshotRef.current = leads;
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveLead(null);
    snapshotRef.current = null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) {
      snapshotRef.current = null;
      return;
    }

    const leadId = String(active.id);
    const overId = String(over.id);

    // Résoudre la colonne cible : soit overId est un id de colonne,
    // soit c'est un lead — on prend alors la colonne du lead survolé.
    let targetCol: LeadBoardColumn | null = columnById.get(overId) ?? null;
    if (!targetCol) {
      const overLead = findLead(overId);
      if (overLead) {
        const colId = getLeadBoardColumnId(
          overLead.pipeline_stage,
          overLead.assigned_to,
          columns
        );
        if (colId) targetCol = columnById.get(colId) ?? null;
      }
    }

    const draggedLead = findLead(leadId);
    if (!targetCol || !draggedLead) {
      snapshotRef.current = null;
      return;
    }

    // Aucun changement effectif ? (même stage + même assignation)
    const sameStage = draggedLead.pipeline_stage === targetCol.stage;
    const sameAssignee =
      targetCol.assignedTo === null
        ? true
        : draggedLead.assigned_to === targetCol.assignedTo;
    if (sameStage && sameAssignee) {
      snapshotRef.current = null;
      return;
    }

    const finalStage = targetCol.stage;
    const finalAssignedTo = targetCol.assignedTo;

    onLeadsChange((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              pipeline_stage: finalStage,
              // On ne touche assigned_to que si la colonne cible le précise
              assigned_to:
                finalAssignedTo !== null ? finalAssignedTo : l.assigned_to,
            }
          : l
      )
    );

    const result =
      finalAssignedTo !== null
        ? await updateLeadStageAndAssignee(leadId, finalStage, finalAssignedTo)
        : await updateLeadStage(leadId, finalStage);

    if (!result.success && snapshotRef.current) {
      const snap = snapshotRef.current;
      onLeadsChange(() => snap);
    }
    snapshotRef.current = null;
  }

  function handleMobileStageChanged(leadId: string, newStage: LeadPipelineStage) {
    onLeadsChange((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, pipeline_stage: newStage } : l
      )
    );
  }

  // Mode mobile : liste verticale groupée par colonne, pas de dnd
  if (isMobile) {
    return (
      <div className="space-y-4">
        {columns.map((col) => {
          const items = leadsByColumn[col.id] ?? [];
          return (
            <section key={col.id} className="space-y-2">
              <header
                className="px-3 py-2 bg-[#111927] border border-[var(--border)] flex items-center justify-between"
                style={{ borderTop: `2px solid ${col.accent}` }}
              >
                <div className="min-w-0">
                  <h3
                    className="font-mono text-[11px] uppercase tracking-wider font-semibold truncate"
                    style={{ color: col.accent }}
                  >
                    {col.label}
                  </h3>
                  <p className="text-[10px] text-muted-foreground/70 truncate">
                    {col.description}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 ml-2">
                  {items.length}
                </span>
              </header>
              {items.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/50 text-center py-3 italic">
                  Aucun lead
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onOpen={onOpenLead}
                      mobile
                      onStageChanged={(stage) =>
                        handleMobileStageChanged(lead.id, stage)
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 min-w-max items-start">
        {columns.map((col) => {
          const items = leadsByColumn[col.id] ?? [];
          return (
            <Column
              key={col.id}
              columnId={col.id}
              accent={col.accent}
              label={col.label}
              description={col.description}
              count={items.length}
            >
              <SortableContext
                items={items.map((l) => l.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onOpen={onOpenLead}
                    />
                  ))}
                </div>
              </SortableContext>
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground/50 text-center py-6 italic">
                  Vide
                </p>
              )}
            </Column>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <LeadCard lead={activeLead} onOpen={() => {}} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ColumnProps {
  columnId: string;
  label: string;
  description: string;
  accent: string;
  count: number;
  children: React.ReactNode;
}

function Column({
  columnId,
  label,
  description,
  accent,
  count,
  children,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { type: "column", columnId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 flex flex-col bg-[#111927] border border-[var(--border)] transition-colors",
        "max-h-[calc(100vh-12rem)]",
        isOver && "border-accent/40 bg-[#111927]/90"
      )}
    >
      {/* Header colonne */}
      <div
        className="px-3 py-2.5 border-b border-[var(--border)]"
        style={{ borderTop: `2px solid ${accent}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3
              className="font-mono text-[11px] uppercase tracking-wider font-semibold truncate"
              style={{ color: accent }}
            >
              {label}
            </h3>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {count}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
          {description}
        </p>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  );
}
