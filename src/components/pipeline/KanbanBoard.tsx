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
import { Plus } from "lucide-react";
import { DealCard } from "./DealCard";
import { STAGES } from "./stages";
import { cn, formatCurrency } from "@/lib/utils";
import { updateDealStage } from "@/lib/actions/deals";
import type { DealStage, DealWithRelations } from "@/types";

interface KanbanBoardProps {
  deals: DealWithRelations[];
  onDealsChange: (
    updater: (prev: DealWithRelations[]) => DealWithRelations[]
  ) => void;
  onOpenDeal: (deal: DealWithRelations) => void;
  onCreateInStage: (stage: DealStage) => void;
}

export function KanbanBoard({
  deals,
  onDealsChange,
  onOpenDeal,
  onCreateInStage,
}: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);
  // Snapshot pour rollback en cas d'erreur Supabase
  const snapshotRef = useRef<DealWithRelations[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Petit délai/distance pour ne pas hijack les clicks sur la card
      activationConstraint: { distance: 4 },
    })
  );

  const dealsByStage = useMemo(() => {
    const acc: Record<DealStage, DealWithRelations[]> = {
      prospect: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      won: [],
      lost: [],
    };
    for (const d of deals) {
      acc[d.stage].push(d);
    }
    return acc;
  }, [deals]);

  function findDeal(id: string): DealWithRelations | undefined {
    return deals.find((d) => d.id === id);
  }

  function handleDragStart(event: DragStartEvent) {
    const deal = findDeal(String(event.active.id));
    if (deal) {
      setActiveDeal(deal);
      snapshotRef.current = deals;
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveDeal(null);
    snapshotRef.current = null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) {
      snapshotRef.current = null;
      return;
    }

    const dealId = String(active.id);
    const overId = String(over.id);

    // overId peut être un stage (id de colonne) OU un id de deal (si on hover une card)
    let targetStage: DealStage | null = null;
    if (
      (
        ["prospect", "qualified", "proposal", "negotiation", "won", "lost"] as DealStage[]
      ).includes(overId as DealStage)
    ) {
      targetStage = overId as DealStage;
    } else {
      const overDeal = findDeal(overId);
      if (overDeal) targetStage = overDeal.stage;
    }

    const draggedDeal = findDeal(dealId);
    if (!targetStage || !draggedDeal || draggedDeal.stage === targetStage) {
      snapshotRef.current = null;
      return;
    }

    // Optimistic update
    const finalStage = targetStage;
    onDealsChange((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: finalStage } : d))
    );

    const result = await updateDealStage(dealId, finalStage);
    if (!result.success && snapshotRef.current) {
      // Rollback
      const snap = snapshotRef.current;
      onDealsChange(() => snap);
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
        {STAGES.map((stage) => {
          const items = dealsByStage[stage.key];
          const stageTotal = items.reduce(
            (sum, d) => sum + (d.value ?? 0),
            0
          );
          return (
            <Column
              key={stage.key}
              stageKey={stage.key}
              accent={stage.accent}
              label={stage.label}
              count={items.length}
              total={stageTotal}
              onAdd={() => onCreateInStage(stage.key)}
            >
              <SortableContext
                items={items.map((d) => d.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {items.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onOpen={onOpenDeal}
                    />
                  ))}
                </div>
              </SortableContext>
            </Column>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <DealCard deal={activeDeal} onOpen={() => {}} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ColumnProps {
  stageKey: DealStage;
  label: string;
  accent: string;
  count: number;
  total: number;
  onAdd: () => void;
  children: React.ReactNode;
}

function Column({
  stageKey,
  label,
  accent,
  count,
  total,
  onAdd,
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
        // Max height pour scroll vertical interne
        "max-h-[calc(100vh-12rem)]",
        isOver && "border-accent/40 bg-[#111927]/90"
      )}
    >
      {/* Header colonne */}
      <div
        className="px-3 py-2.5 border-b border-[var(--border)] flex items-center justify-between gap-2"
        style={{ borderTop: `2px solid ${accent}` }}
      >
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
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {total > 0 ? formatCurrency(total) : "—"}
        </span>
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {children}
        <button
          type="button"
          onClick={onAdd}
          className="w-full py-2 text-[11px] text-muted-foreground hover:text-accent border border-dashed border-[var(--border)] hover:border-accent/40 transition-colors inline-flex items-center justify-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Ajouter un deal
        </button>
      </div>
    </div>
  );
}
