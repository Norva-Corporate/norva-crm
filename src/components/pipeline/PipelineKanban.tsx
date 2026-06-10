"use client";
import React, { useCallback, useMemo, useRef, useState } from "react";
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
import { Plus, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { DealCard } from "./DealCard";
import { LeadCard } from "@/components/leads/LeadCard";
import {
  buildUnifiedColumns,
  getDealColumnId,
  getLeadColumnId,
  isConversionBoundary,
  type UnifiedColumn,
} from "./unified-stages";
import { cn, formatCurrency } from "@/lib/utils";
import { updateDealStage } from "@/lib/actions/deals";
import {
  convertLeadToDeal,
  updateLeadStage,
  updateLeadStageAndAssignee,
  type LeadAssignee,
  type LeadWithDedup,
} from "@/lib/actions/leads";
import { useIsMobile } from "@/hooks/use-media-query";
import type { DealStage, DealWithRelations } from "@/types";

interface PipelineKanbanProps {
  leads: LeadWithDedup[];
  deals: DealWithRelations[];
  profiles: LeadAssignee[];
  /** Si false : la colonne 'Brut' et ses leads sont retirés du rendu
   *  (réduit drastiquement le DOM quand le volume de leads bruts est gros). */
  showBrut: boolean;
  /** Filtre texte appliqué sur le nom du lead/contact et le nom d'entreprise.
   *  Vide = aucune filtre. */
  searchQuery: string;
  /** Si non-null : filtre les leads dont assigned_to ne matche pas ce
   *  profile.id. Les deals ne sont pas filtrés par owner ici (les deals
   *  ont leur propre assigné — feature future si besoin). */
  ownerProfileId: string | null;
  /** Si true : ne montre que les leads avec quality_score >= 80. */
  topQualityOnly: boolean;
  onLeadsChange: (
    updater: (prev: LeadWithDedup[]) => LeadWithDedup[]
  ) => void;
  onDealsChange: (
    updater: (prev: DealWithRelations[]) => DealWithRelations[]
  ) => void;
  onOpenLead: (lead: LeadWithDedup) => void;
  onOpenDeal: (deal: DealWithRelations) => void;
  onCreateDealInStage: (stage: DealStage) => void;
  /** Set des leadIds sélectionnés (bulk actions). Undefined = pas de mode bulk. */
  selectedLeadIds?: Set<string>;
  onToggleLeadSelect?: (leadId: string) => void;
}

type ActiveItem =
  | { kind: "lead"; lead: LeadWithDedup }
  | { kind: "deal"; deal: DealWithRelations };

export function PipelineKanban({
  leads,
  deals,
  profiles,
  showBrut,
  searchQuery,
  ownerProfileId,
  topQualityOnly,
  onLeadsChange,
  onDealsChange,
  onOpenLead,
  onOpenDeal,
  onCreateDealInStage,
  selectedLeadIds,
  onToggleLeadSelect,
}: PipelineKanbanProps) {
  const isMobile = useIsMobile();
  const [active, setActive] = useState<ActiveItem | null>(null);
  const leadsSnapshot = useRef<LeadWithDedup[] | null>(null);
  const dealsSnapshot = useRef<DealWithRelations[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  // Toutes les colonnes selon les profils — la liste de référence.
  const allColumns = useMemo(() => buildUnifiedColumns(profiles), [profiles]);

  // Colonnes effectivement affichées :
  // 1) Retire la colonne 'Brut' si showBrut=false (sup. rendu + cards).
  // 2) Quand un ownerFilter est actif, on masque les sous-colonnes
  //    'À contacter — X' des AUTRES owners — sinon le board reste à
  //    9 colonnes (Kylian/Lohan/Laurent) avec 2 colonnes systématiquement
  //    vides, ce qui pollue le scan visuel quand on travaille sur ses
  //    propres leads. La sous-colonne de l'owner sélectionné reste.
  const columns = useMemo(
    () => {
      let cols = showBrut
        ? allColumns
        : allColumns.filter(
            (c) => !(c.kind === "lead" && c.stage === "brut")
          );
      if (ownerProfileId) {
        cols = cols.filter(
          (c) =>
            !(
              c.kind === "lead" &&
              c.stage === "to_contact" &&
              c.assignedTo !== ownerProfileId
            )
        );
      }
      return cols;
    },
    [allColumns, showBrut, ownerProfileId]
  );

  // Leads filtrés selon showBrut + searchQuery + ownerProfileId + topQualityOnly.
  const visibleLeads = useMemo(() => {
    let base = showBrut
      ? leads
      : leads.filter((l) => l.pipeline_stage !== "brut");

    if (ownerProfileId) {
      base = base.filter((l) => l.assigned_to === ownerProfileId);
    }
    if (topQualityOnly) {
      base = base.filter(
        (l) => l.quality_score != null && l.quality_score >= 80
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    // Normalisation chiffres : permet de matcher un numéro tapé sans
    // espaces (« 0612 ») contre un téléphone stocké formaté (« 06 12 … »).
    const digits = q.replace(/\D/g, "");
    return base.filter((l) => {
      const name = `${l.first_name ?? ""} ${l.last_name ?? ""}`
        .toLowerCase()
        .trim();
      const company = (l.company_name ?? "").toLowerCase();
      const email = (l.email ?? "").toLowerCase();
      const phone = (l.phone ?? "").toLowerCase();
      return (
        name.includes(q) ||
        company.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        (digits.length >= 3 && phone.replace(/\D/g, "").includes(digits))
      );
    });
  }, [leads, showBrut, searchQuery, ownerProfileId, topQualityOnly]);

  // Deals filtrés selon searchQuery (title + contact + company).
  const visibleDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => {
      const title = d.title.toLowerCase();
      const contact = d.contact
        ? `${d.contact.first_name} ${d.contact.last_name}`.toLowerCase()
        : "";
      const company = d.company?.name?.toLowerCase() ?? "";
      return (
        title.includes(q) || contact.includes(q) || company.includes(q)
      );
    });
  }, [deals, searchQuery]);

  const columnById = useMemo(() => {
    const m = new Map<string, UnifiedColumn>();
    for (const c of columns) m.set(c.id, c);
    return m;
  }, [columns]);

  /** Bucket : leads + deals dispatchés dans leurs colonnes. */
  const itemsByColumn = useMemo(() => {
    const acc: Record<string, ActiveItem[]> = {};
    for (const c of columns) acc[c.id] = [];

    const firstToContactColId =
      columns.find((c) => c.kind === "lead" && c.stage === "to_contact")?.id ??
      null;

    for (const l of visibleLeads) {
      const colId = getLeadColumnId(l.pipeline_stage, l.assigned_to, columns);
      if (colId && acc[colId]) {
        acc[colId].push({ kind: "lead", lead: l });
      } else if (l.pipeline_stage === "to_contact" && firstToContactColId) {
        acc[firstToContactColId].push({ kind: "lead", lead: l });
      }
    }
    for (const d of visibleDeals) {
      const colId = getDealColumnId(d.stage);
      if (acc[colId]) acc[colId].push({ kind: "deal", deal: d });
    }
    return acc;
  }, [columns, visibleLeads, visibleDeals]);

  /** Suppression optimiste d'un lead dismiss / mise à jour du status si qualified. */
  const handleLeadChanged = useCallback(
    (
      leadId: string,
      change: { dismissed?: true; qualified?: true; coldEmailed?: true }
    ) => {
      if (change.dismissed) {
        onLeadsChange((prev) => prev.filter((l) => l.id !== leadId));
      } else if (change.coldEmailed) {
        // Passé en 'to_email' : aucune colonne sur le board → le lead
        // quitte le board (géré ensuite via la page Campagnes).
        onLeadsChange((prev) =>
          prev.map((l) =>
            l.id === leadId
              ? { ...l, pipeline_stage: "to_email", status: "qualified" }
              : l
          )
        );
      } else if (change.qualified) {
        onLeadsChange((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: "qualified" } : l
          )
        );
      }
    },
    [onLeadsChange]
  );

  function findLead(id: string) {
    return leads.find((l) => l.id === id);
  }
  function findDeal(id: string) {
    return deals.find((d) => d.id === id);
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const lead = findLead(id);
    if (lead) {
      setActive({ kind: "lead", lead });
      leadsSnapshot.current = leads;
      return;
    }
    const deal = findDeal(id);
    if (deal) {
      setActive({ kind: "deal", deal });
      dealsSnapshot.current = deals;
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActive(null);
    leadsSnapshot.current = null;
    dealsSnapshot.current = null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    setActive(null);

    if (!over) {
      leadsSnapshot.current = null;
      dealsSnapshot.current = null;
      return;
    }

    const draggedId = String(dragged.id);
    const overId = String(over.id);

    // Résoudre la colonne cible : overId est soit un id de colonne,
    // soit un id d'item (carte survolée) → on remonte à sa colonne.
    let targetCol: UnifiedColumn | null = columnById.get(overId) ?? null;
    if (!targetCol) {
      const overLead = findLead(overId);
      if (overLead) {
        const colId = getLeadColumnId(
          overLead.pipeline_stage,
          overLead.assigned_to,
          columns
        );
        if (colId) targetCol = columnById.get(colId) ?? null;
      } else {
        const overDeal = findDeal(overId);
        if (overDeal) {
          targetCol = columnById.get(getDealColumnId(overDeal.stage)) ?? null;
        }
      }
    }
    if (!targetCol) {
      leadsSnapshot.current = null;
      dealsSnapshot.current = null;
      return;
    }

    const draggedLead = findLead(draggedId);
    if (draggedLead) {
      await handleLeadDrop(draggedLead, targetCol);
      return;
    }
    const draggedDeal = findDeal(draggedId);
    if (draggedDeal) {
      await handleDealDrop(draggedDeal, targetCol);
    }
  }

  async function handleLeadDrop(lead: LeadWithDedup, target: UnifiedColumn) {
    if (target.kind === "lead") {
      // Lead → colonne lead : pareil que LeadsKanban (stage + éventuelle assignation)
      const sameStage = lead.pipeline_stage === target.stage;
      const sameAssignee =
        target.assignedTo === null
          ? true
          : lead.assigned_to === target.assignedTo;
      if (sameStage && sameAssignee) {
        leadsSnapshot.current = null;
        return;
      }

      const finalStage = target.stage;
      const finalAssignee = target.assignedTo;

      onLeadsChange((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                pipeline_stage: finalStage,
                assigned_to:
                  finalAssignee !== null ? finalAssignee : l.assigned_to,
              }
            : l
        )
      );

      const result =
        finalAssignee !== null
          ? await updateLeadStageAndAssignee(lead.id, finalStage, finalAssignee)
          : await updateLeadStage(lead.id, finalStage);

      if (!result.success) {
        // Rollback du state local + feedback explicite.
        if (leadsSnapshot.current) {
          const snap = leadsSnapshot.current;
          onLeadsChange(() => snap);
        }
        toast.error(result.error ?? "Impossible de déplacer le lead.");
        leadsSnapshot.current = null;
        return;
      }

      // Feedback UX : si on arrive sur contacted/stand_by sans date de
      // relance posée, aucune tâche n'est créée — l'utilisateur doit le
      // savoir explicitement, sinon il pense que la feature est cassée.
      if (
        (finalStage === "contacted" || finalStage === "stand_by") &&
        !lead.next_follow_up_at
      ) {
        toast.info(
          "Pas de date de relance posée — aucune tâche créée. Ouvre la fiche du lead pour en poser une.",
          { duration: 6000 }
        );
      }

      leadsSnapshot.current = null;
      return;
    }

    // Lead → colonne deal : conversion automatique
    const targetStage = target.stage;
    // Optimistic : retire le lead du board pendant la conversion
    onLeadsChange((prev) => prev.filter((l) => l.id !== lead.id));

    const result = await convertLeadToDeal(lead.id, { deal_stage: targetStage });
    if (!result.success) {
      toast.error(result.error ?? "Conversion impossible.");
      if (leadsSnapshot.current) {
        const snap = leadsSnapshot.current;
        onLeadsChange(() => snap);
      }
      leadsSnapshot.current = null;
      return;
    }

    toast.success(`Lead converti → deal ${targetStage}.`);
    // Le router.refresh() de la page parente recharge leads + deals
    // (la page sera revalidée par convertLeadToDeal).
    leadsSnapshot.current = null;
    dealsSnapshot.current = null;
  }

  async function handleDealDrop(deal: DealWithRelations, target: UnifiedColumn) {
    if (target.kind === "lead") {
      // Deal → colonne lead : refusé
      toast.error("Un deal ne peut pas être renvoyé en prospection.");
      dealsSnapshot.current = null;
      return;
    }
    if (deal.stage === target.stage) {
      dealsSnapshot.current = null;
      return;
    }

    const finalStage = target.stage;
    onDealsChange((prev) =>
      prev.map((d) => (d.id === deal.id ? { ...d, stage: finalStage } : d))
    );

    const result = await updateDealStage(deal.id, finalStage);
    if (!result.success && dealsSnapshot.current) {
      const snap = dealsSnapshot.current;
      onDealsChange(() => snap);
    }
    dealsSnapshot.current = null;
  }

  // Mode mobile : sélecteur de colonne (chips scrollables horizontalement)
  // + UNE colonne affichée à la fois + swipe gauche/droite pour naviguer.
  // Évite le scroll infini de la version précédente (toutes colonnes empilées).
  if (isMobile) {
    return (
      <MobilePipelineView
        columns={columns}
        itemsByColumn={itemsByColumn}
        onOpenLead={onOpenLead}
        onOpenDeal={onOpenDeal}
      />
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
        {columns.map((col, idx) => {
          const items = itemsByColumn[col.id] ?? [];
          const prev = idx > 0 ? columns[idx - 1] : null;
          const showSeparator = prev ? isConversionBoundary(prev, col) : false;

          const stageTotal =
            col.kind === "deal"
              ? items.reduce(
                  (sum, it) =>
                    it.kind === "deal" ? sum + (it.deal.value ?? 0) : sum,
                  0
                )
              : 0;

          return (
            <React.Fragment key={col.id}>
              {showSeparator && <ConversionSeparator />}
              <Column
                columnId={col.id}
                col={col}
                count={items.length}
                dealTotal={col.kind === "deal" ? stageTotal : null}
                onAddDeal={
                  col.kind === "deal"
                    ? () => onCreateDealInStage(col.stage)
                    : null
                }
              >
                <SortableContext
                  items={items.map((it) =>
                    it.kind === "lead" ? it.lead.id : it.deal.id
                  )}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((it) =>
                      it.kind === "lead" ? (
                        <LeadCard
                          key={it.lead.id}
                          lead={it.lead}
                          onOpen={onOpenLead}
                          onLeadChanged={handleLeadChanged}
                          selected={selectedLeadIds?.has(it.lead.id) ?? false}
                          onToggleSelect={onToggleLeadSelect}
                        />
                      ) : (
                        <DealCard
                          key={it.deal.id}
                          deal={it.deal}
                          onOpen={onOpenDeal}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </Column>
            </React.Fragment>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {active?.kind === "lead" ? (
          <LeadCard lead={active.lead} onOpen={() => {}} overlay />
        ) : active?.kind === "deal" ? (
          <DealCard deal={active.deal} onOpen={() => {}} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ColumnProps {
  columnId: string;
  col: UnifiedColumn;
  count: number;
  dealTotal: number | null;
  onAddDeal: (() => void) | null;
  children: React.ReactNode;
}

function Column({
  columnId,
  col,
  count,
  dealTotal,
  onAddDeal,
  children,
}: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { type: "column", kind: col.kind },
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
      <div
        className="px-3 py-2.5 border-b border-[var(--border)] flex items-center justify-between gap-2"
        style={{ borderTop: `2px solid ${col.accent}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3
            className="font-mono text-[11px] uppercase tracking-wider font-semibold truncate"
            style={{ color: col.accent }}
          >
            {col.label}
          </h3>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {count}
          </span>
        </div>
        {dealTotal !== null && (
          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {dealTotal > 0 ? formatCurrency(dealTotal) : "—"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {children}
        {onAddDeal && (
          <button
            type="button"
            onClick={onAddDeal}
            className="w-full py-2 text-[11px] text-muted-foreground hover:text-accent border border-dashed border-[var(--border)] hover:border-accent/40 transition-colors inline-flex items-center justify-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Ajouter un deal
          </button>
        )}
      </div>
    </div>
  );
}

/** Séparateur visuel entre la dernière colonne lead et la première deal. */
function ConversionSeparator() {
  return (
    <div className="shrink-0 flex flex-col items-center justify-start pt-12 px-1">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
        Conversion
      </div>
      <ArrowRight className="h-4 w-4 text-accent" />
      <div className="mt-2 h-[60vh] w-px bg-[var(--border)]" />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * MOBILE VIEW
 * Selector horizontal de colonnes (chips scrollables) + UNE colonne visible
 * + swipe gauche/droite pour naviguer. Pas de DnD, les cards utilisent leur
 * <select> de stage natif pour changer de colonne.
 * ------------------------------------------------------------------------- */

interface MobilePipelineViewProps {
  columns: UnifiedColumn[];
  itemsByColumn: Record<string, ActiveItem[]>;
  onOpenLead: (lead: LeadWithDedup) => void;
  onOpenDeal: (deal: DealWithRelations) => void;
}

const SWIPE_THRESHOLD = 50; // px de déplacement minimal pour valider un swipe

function MobilePipelineView({
  columns,
  itemsByColumn,
  onOpenLead,
  onOpenDeal,
}: MobilePipelineViewProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const chipsRef = useRef<HTMLDivElement>(null);
  const activeChipRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Si le nombre de colonnes change (ex: showBrut toggle), recale l'index.
  React.useEffect(() => {
    if (activeIdx >= columns.length) {
      setActiveIdx(Math.max(0, columns.length - 1));
    }
  }, [columns.length, activeIdx]);

  // Auto-scroll du chip actif dans la barre horizontale (visibilité)
  React.useEffect(() => {
    const node = activeChipRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIdx]);

  const activeCol = columns[activeIdx];
  const activeItems = activeCol ? itemsByColumn[activeCol.id] ?? [] : [];

  function goPrev() {
    setActiveIdx((i) => Math.max(0, i - 1));
  }
  function goNext() {
    setActiveIdx((i) => Math.min(columns.length - 1, i + 1));
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const dx = endX - touchStartX.current;
    const dy = endY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Ignore les gestes verticaux dominants (scroll naturel de la liste)
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  if (!activeCol) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Aucune colonne à afficher.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Selector horizontal de colonnes */}
      <div
        ref={chipsRef}
        className="-mx-4 px-4 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex items-center gap-1.5 min-w-max">
          {columns.map((col, idx) => {
            const isActive = idx === activeIdx;
            const count = itemsByColumn[col.id]?.length ?? 0;
            return (
              <button
                key={col.id}
                ref={isActive ? activeChipRef : undefined}
                type="button"
                onClick={() => setActiveIdx(idx)}
                aria-pressed={isActive}
                className={cn(
                  "h-9 px-3 inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap transition-colors rounded-sm border",
                  isActive
                    ? "bg-[#111927] text-foreground"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-foreground"
                )}
                style={
                  isActive
                    ? { borderColor: col.accent, color: col.accent }
                    : undefined
                }
              >
                <span className="font-mono uppercase tracking-wider text-[10px]">
                  {col.label}
                </span>
                <span className="tabular-nums text-[10px] text-muted-foreground">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header de la colonne active (montre l'accent) */}
      <header
        className="px-3 py-2 bg-[#111927] border border-[var(--border)] flex items-center justify-between"
        style={{ borderTop: `2px solid ${activeCol.accent}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={goPrev}
            disabled={activeIdx === 0}
            aria-label="Colonne précédente"
            className="inline-flex h-8 w-8 -ml-1 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3
            className="font-mono text-[11px] uppercase tracking-wider font-semibold truncate"
            style={{ color: activeCol.accent }}
          >
            {activeCol.label}
          </h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {activeItems.length}
          </span>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={activeIdx === columns.length - 1}
          aria-label="Colonne suivante"
          className="inline-flex h-8 w-8 -mr-1 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </header>

      {/* Liste verticale des cards de la colonne active + swipe X */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="space-y-2 min-h-[40vh]"
      >
        {activeItems.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/50 text-center py-6 italic">
            Vide
          </p>
        ) : (
          activeItems.map((it) =>
            it.kind === "lead" ? (
              <LeadCard
                key={it.lead.id}
                lead={it.lead}
                onOpen={onOpenLead}
                mobile
              />
            ) : (
              <DealCard
                key={it.deal.id}
                deal={it.deal}
                onOpen={onOpenDeal}
                mobile
              />
            )
          )
        )}
      </div>
    </div>
  );
}
