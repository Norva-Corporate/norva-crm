"use client";
import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { KanbanBoard } from "./KanbanBoard";
import { ListView } from "./ListView";
import { DealDrawer } from "./DealDrawer";
import { OPEN_STAGES } from "./stages";
import { cn, formatCurrency } from "@/lib/utils";
import { deleteDeal } from "@/lib/actions/deals";
import type { DealStage, DealWithRelations } from "@/types";

type ViewMode = "kanban" | "list";

interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
  company_id?: string | null;
}

interface ProfileOption {
  id: string;
  full_name: string | null;
}

interface PipelineClientProps {
  initialDeals: DealWithRelations[];
  contacts: ContactOption[];
  companies: { id: string; name: string }[];
  profiles: ProfileOption[];
}

export function PipelineClient({
  initialDeals,
  contacts,
  companies,
  profiles,
}: PipelineClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deals, setDeals] = useState<DealWithRelations[]>(initialDeals);
  const [view, setView] = useState<ViewMode>("kanban");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithRelations | null>(
    null
  );
  const [creatingInStage, setCreatingInStage] = useState<DealStage | undefined>(
    undefined
  );

  const [deleting, setDeleting] = useState<DealWithRelations | null>(null);

  const totalOpen = useMemo(
    () =>
      deals
        .filter((d) => OPEN_STAGES.includes(d.stage))
        .reduce((s, d) => s + (d.value ?? 0), 0),
    [deals]
  );

  const totalWon = useMemo(
    () =>
      deals
        .filter((d) => d.stage === "won")
        .reduce((s, d) => s + (d.value ?? 0), 0),
    [deals]
  );

  function openCreate() {
    setEditingDeal(null);
    setCreatingInStage(undefined);
    setDrawerOpen(true);
  }

  function openCreateInStage(stage: DealStage) {
    setEditingDeal(null);
    setCreatingInStage(stage);
    setDrawerOpen(true);
  }

  function openEdit(deal: DealWithRelations) {
    setEditingDeal(deal);
    setCreatingInStage(undefined);
    setDrawerOpen(true);
  }

  function handleSaved(deal: DealWithRelations, mode: "create" | "update") {
    if (mode === "create") {
      setDeals((prev) => [deal, ...prev]);
    } else {
      setDeals((prev) => prev.map((d) => (d.id === deal.id ? deal : d)));
    }
    startTransition(() => router.refresh());
  }

  function handleDeletedFromDrawer(id: string) {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    startTransition(() => router.refresh());
  }

  function handleStageChangedFromDrawer(id: string, stage: DealStage) {
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, stage } : d))
    );
    startTransition(() => router.refresh());
  }

  function handleDeleteFromList() {
    if (!deleting) return Promise.resolve({ success: true } as const);
    const target = deleting;
    return deleteDeal(target.id).then((res) => {
      if (res.success) {
        setDeals((prev) => prev.filter((d) => d.id !== target.id));
        startTransition(() => router.refresh());
      }
      return res;
    });
  }

  return (
    <>
      <Header
        title="Pipeline"
        action={{ label: "Nouveau deal", onClick: openCreate }}
      />

      <div className="flex-1 flex flex-col animate-fade-in min-h-0">
        {/* Toolbar */}
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-4 flex items-center gap-3 md:gap-4 flex-wrap">
          {/* Total pipeline */}
          <div className="flex items-baseline gap-2 md:gap-3 mr-auto">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                Pipeline ouvert
              </p>
              <p className="font-mono text-xl md:text-2xl font-semibold text-foreground tabular-nums leading-tight">
                {formatCurrency(totalOpen)}
              </p>
            </div>
            <div className="border-l border-[var(--border)] pl-2 md:pl-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                Gagné
              </p>
              <p className="font-mono text-sm md:text-base text-[#4ADE80] tabular-nums leading-tight">
                {formatCurrency(totalWon)}
              </p>
            </div>
            <div className="border-l border-[var(--border)] pl-2 md:pl-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                Deals
              </p>
              <p className="font-mono text-sm md:text-base text-foreground tabular-nums leading-tight">
                {deals.length}
              </p>
            </div>
          </div>

          {/* Switcher Kanban / Liste */}
          <div className="inline-flex border border-[var(--border)] bg-[var(--surface)] p-0.5">
            <ViewButton
              active={view === "kanban"}
              onClick={() => setView("kanban")}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              label="Kanban"
            />
            <ViewButton
              active={view === "list"}
              onClick={() => setView("list")}
              icon={<List className="h-3.5 w-3.5" />}
              label="Liste"
            />
          </div>
        </div>

        {/* Vue */}
        <div className="flex-1 min-h-0">
          {view === "kanban" ? (
            <div className="h-full md:overflow-x-auto px-4 md:px-6 pb-6">
              <KanbanBoard
                deals={deals}
                onDealsChange={(updater) => setDeals((prev) => updater(prev))}
                onOpenDeal={openEdit}
                onCreateInStage={openCreateInStage}
              />
            </div>
          ) : (
            <div className="px-4 md:px-6 pb-6">
              <ListView
                deals={deals}
                onOpenDeal={openEdit}
                onDeleteDeal={(d) => setDeleting(d)}
              />
            </div>
          )}
        </div>
      </div>

      <DealDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        deal={editingDeal}
        defaultStage={creatingInStage}
        contacts={contacts}
        companies={companies}
        profiles={profiles}
        onSaved={handleSaved}
        onDeleted={handleDeletedFromDrawer}
        onStageChanged={handleStageChangedFromDrawer}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="le deal"
        itemName={deleting?.title ?? ""}
        onConfirm={handleDeleteFromList}
      />
    </>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 px-2.5 inline-flex items-center gap-1.5 text-xs transition-colors",
        active
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
