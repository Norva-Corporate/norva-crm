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
import { LEAD_STAGES, LEAD_STAGE_KEYS } from "./stages";
import { cn } from "@/lib/utils";
import { updateLeadStage } from "@/lib/actions/leads";
import type {
  LeadPipelineStage,
  LeadWithDedup,
} from "@/lib/actions/leads";

interface LeadsKanbanProps {
  leads: LeadWithDedup[];
  onLeadsChange: (
    updater: (prev: LeadWithDedup[]) => LeadWithDedup[]
  ) => void;
  onOpenLead: (lead: LeadWithDedup) => void;
}

export function LeadsKanban({
  leads,
  onLeadsChange,
  onOpenLead,
}: LeadsKanbanProps) {
  const [activeLead, setActiveLead] = useState<LeadWithDedup | null>(null);
  const snapshotRef = useRef<LeadWithDedup[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const leadsByStage = useMemo(() => {
    const acc: Record<LeadPipelineStage, LeadWithDedup[]> = {
      brut: [],
      verified: [],
      to_contact: [],
      contacted: [],
      in_discussion: [],
    };
    for (const l of leads) {
      acc[l.pipeline_stage].push(l);
    }
    return acc;
  }, [leads]);

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

    // overId peut être un stage (colonne) OU un id de lead (card)
    let targetStage: LeadPipelineStage | null = null;
    if (LEAD_STAGE_KEYS.includes(overId as LeadPipelineStage)) {
      targetStage = overId as LeadPipelineStage;
    } else {
      const overLead = findLead(overId);
      if (overLead) targetStage = overLead.pipeline_stage;
    }

    const draggedLead = findLead(leadId);
    if (
      !targetStage ||
      !draggedLead ||
      draggedLead.pipeline_stage === targetStage
    ) {
      snapshotRef.current = null;
      return;
    }

    // Optimistic
    const finalStage = targetStage;
    onLeadsChange((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, pipeline_stage: finalStage } : l
      )
    );

    const result = await updateLeadStage(leadId, finalStage);
    if (!result.success && snapshotRef.current) {
      const snap = snapshotRef.current;
      onLeadsChange(() => snap);
    }
    snapshotRef.current = null;
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
        {LEAD_STAGES.map((stage) => {
          const items = leadsByStage[stage.key];
          return (
            <Column
              key={stage.key}
              stageKey={stage.key}
              accent={stage.accent}
              label={stage.label}
              description={stage.description}
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
  stageKey: LeadPipelineStage;
  label: string;
  description: string;
  accent: string;
  count: number;
  children: React.ReactNode;
}

function Column({
  stageKey,
  label,
  description,
  accent,
  count,
  children,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageKey,
    data: { type: "column", stage: stageKey },
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
