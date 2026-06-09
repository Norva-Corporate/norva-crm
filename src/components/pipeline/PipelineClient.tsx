"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LayoutGrid, List, Search, Star } from "lucide-react";
import { useIsMobile } from "@/hooks/use-media-query";
import { TO_CONTACT_OWNERS } from "@/lib/team";
import { ExportCsvButton } from "@/components/ui/export-csv-button";
import { formatDate } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { PipelineKanban } from "./PipelineKanban";
import { ListView } from "./ListView";
import { DealDrawer } from "./DealDrawer";
import { BulkActionBar } from "./BulkActionBar";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { OPEN_STAGES } from "./stages";
import { cn, formatCurrency } from "@/lib/utils";
import { deleteDeal } from "@/lib/actions/deals";
import type {
  LeadAssignee,
  LeadWithDedup,
} from "@/lib/actions/leads";
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
  initialLeads: LeadWithDedup[];
  contacts: ContactOption[];
  companies: { id: string; name: string }[];
  profiles: ProfileOption[];
  leadProfiles: LeadAssignee[];
}

export function PipelineClient({
  initialDeals,
  initialLeads,
  contacts,
  companies,
  profiles,
  leadProfiles,
}: PipelineClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const isMobile = useIsMobile();
  const [deals, setDeals] = useState<DealWithRelations[]>(initialDeals);
  const [leads, setLeads] = useState<LeadWithDedup[]>(initialLeads);
  const [view, setView] = useState<ViewMode>("kanban");
  // Sur mobile, on force la vue kanban (la ListView est cachée et le selector
  // de colonne du Kanban mobile fait office de liste navigable).
  const effectiveView: ViewMode = isMobile ? "kanban" : view;
  const [openLead, setOpenLead] = useState<LeadWithDedup | null>(null);

  // Recherche libre dans le kanban — filtre par nom/entreprise sur leads
  // ET deals. État local, pas persisté (volontaire : la recherche est
  // contextuelle à la session). Min 1 char pour activer le filtre.
  const [searchQuery, setSearchQuery] = useState("");

  // Filtre par owner (Kylian / Lohan / Laurent / null=tous). Persisté en
  // localStorage : avec 3 owners, le board peut atteindre 9 colonnes et le
  // choix utilisateur doit survivre aux rechargements/navigation. Le filtre
  // épure aussi le board (cf. PipelineKanban — masque les sous-colonnes
  // 'À contacter' des AUTRES owners quand le filtre est actif).
  const OWNER_FILTER_STORAGE_KEY = "norva.pipeline.ownerFilter";
  const [ownerFilter, setOwnerFilterState] = useState<string | null>(null);
  useEffect(() => {
    const stored = window.localStorage.getItem(OWNER_FILTER_STORAGE_KEY);
    if (stored) setOwnerFilterState(stored);
  }, []);
  const setOwnerFilter = useCallback((next: string | null) => {
    setOwnerFilterState(next);
    if (next) {
      window.localStorage.setItem(OWNER_FILTER_STORAGE_KEY, next);
    } else {
      window.localStorage.removeItem(OWNER_FILTER_STORAGE_KEY);
    }
  }, []);
  // Filtre quality top (true = uniquement les leads avec quality_score >= 80).
  // État session, non persisté.
  const [topQualityOnly, setTopQualityOnly] = useState(false);
  // Map email → profile.id pour le filtre owner (les leadProfiles ont
  // l'email + l'id, on s'en sert pour matcher lead.assigned_to).
  const ownerEmailToProfileId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of leadProfiles) {
      if (p.email) m.set(p.email.toLowerCase(), p.id);
    }
    return m;
  }, [leadProfiles]);
  const selectedOwnerProfileId = ownerFilter
    ? ownerEmailToProfileId.get(ownerFilter.toLowerCase()) ?? null
    : null;

  // Re-sync les states locaux quand le server component re-fetch après
  // un router.refresh() (par exemple suite à un dismiss / convert ou un
  // nouveau lead Multica importé en arrière-plan). Sans ça, useState
  // initial gèle les premières valeurs.
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  // Toggle d'affichage des leads en stage 'brut' (la grosse majorité des
  // cards). Masquer par défaut diminue drastiquement le DOM rendu.
  // Persiste dans localStorage pour respecter le choix utilisateur.
  const BRUT_STORAGE_KEY = "norva.pipeline.showBrut";
  const [showBrut, setShowBrut] = useState(false);
  const [brutHydrated, setBrutHydrated] = useState(false);
  useEffect(() => {
    const stored = window.localStorage.getItem(BRUT_STORAGE_KEY);
    if (stored === "1") setShowBrut(true);
    setBrutHydrated(true);
  }, []);
  const handleToggleBrut = useCallback(() => {
    setShowBrut((prev) => {
      const next = !prev;
      window.localStorage.setItem(BRUT_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);
  const brutCount = useMemo(
    () => leads.filter((l) => l.pipeline_stage === "brut").length,
    [leads]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithRelations | null>(
    null
  );
  const [creatingInStage, setCreatingInStage] = useState<DealStage | undefined>(
    undefined
  );

  const [deleting, setDeleting] = useState<DealWithRelations | null>(null);

  // Bulk select kanban — Set des leadIds sélectionnés. Clear quand on
  // change de vue (Kanban → Liste) pour éviter une sélection invisible.
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    () => new Set()
  );
  const toggleLeadSelect = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedLeadIds(new Set());
  }, []);
  useEffect(() => {
    if (view !== "kanban" && selectedLeadIds.size > 0) {
      setSelectedLeadIds(new Set());
    }
  }, [view, selectedLeadIds.size]);

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

  // Handlers stabilisés via useCallback : permet à PipelineKanban + ses
  // sous-composants (LeadCard, DealCard mémoïsés) de skip les rerenders
  // quand seul un state interne du parent change (ex : ouverture drawer).
  const openCreate = useCallback(() => {
    setEditingDeal(null);
    setCreatingInStage(undefined);
    setDrawerOpen(true);
  }, []);

  const openCreateInStage = useCallback((stage: DealStage) => {
    setEditingDeal(null);
    setCreatingInStage(stage);
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((deal: DealWithRelations) => {
    setEditingDeal(deal);
    setCreatingInStage(undefined);
    setDrawerOpen(true);
  }, []);

  // Auto-ouverture du drawer quand la palette globale (ou un autre lien)
  // pousse `?open=lead:<id>` ou `?open=deal:<id>` sur l'URL. On nettoie
  // l'URL après ouverture pour éviter de ré-ouvrir si le drawer est fermé.
  useEffect(() => {
    const param = searchParams.get("open");
    if (!param) return;
    const [kind, id] = param.split(":");
    if (!kind || !id) return;
    if (kind === "lead") {
      const target = leads.find((l) => l.id === id);
      if (target) setOpenLead(target);
    } else if (kind === "deal") {
      const target = deals.find((d) => d.id === id);
      if (target) {
        setEditingDeal(target);
        setCreatingInStage(undefined);
        setDrawerOpen(true);
      }
    }
    // Nettoie le param sans recharger la page.
    router.replace("/dashboard/pipeline", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSaved = useCallback(
    (deal: DealWithRelations, mode: "create" | "update") => {
      if (mode === "create") {
        setDeals((prev) => [deal, ...prev]);
      } else {
        setDeals((prev) => prev.map((d) => (d.id === deal.id ? deal : d)));
      }
      startTransition(() => router.refresh());
    },
    [router]
  );

  const handleDeletedFromDrawer = useCallback(
    (id: string) => {
      setDeals((prev) => prev.filter((d) => d.id !== id));
      startTransition(() => router.refresh());
    },
    [router]
  );

  const handleStageChangedFromDrawer = useCallback(
    (id: string, stage: DealStage) => {
      setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
      startTransition(() => router.refresh());
    },
    [router]
  );

  // Setters stables pour PipelineKanban (évite la réf qui change à chaque render)
  const handleLeadsChange = useCallback(
    (updater: (prev: LeadWithDedup[]) => LeadWithDedup[]) =>
      setLeads((prev) => updater(prev)),
    []
  );
  const handleDealsChange = useCallback(
    (updater: (prev: DealWithRelations[]) => DealWithRelations[]) =>
      setDeals((prev) => updater(prev)),
    []
  );
  const handleOpenLead = useCallback(
    (lead: LeadWithDedup) => setOpenLead(lead),
    []
  );

  /** Sync le state local après dismiss/qualify/convert depuis le drawer.
   *  Sans ça, le lead reste visible dans le kanban jusqu'à un refresh
   *  manuel (useState(initialLeads) est gelé après le 1er mount). */
  const handleLeadDrawerChanged = useCallback(
    (
      leadId: string,
      change: { dismissed?: true; converted?: true; qualified?: true }
    ) => {
      if (change.dismissed || change.converted) {
        // Status terminal → le lead sort du kanban
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
      } else if (change.qualified) {
        // Maj status local pour cohérence avec la vue liste
        setLeads((prev) =>
          prev.map((l) =>
            l.id === leadId ? { ...l, status: "qualified" } : l
          )
        );
      }
    },
    []
  );

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

          {/* Recherche + filtres — uniquement en vue kanban. */}
          {effectiveView === "kanban" && (
            <>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher…"
                  className={cn(
                    "h-7 pl-7 pr-2 text-xs border border-[var(--border)] bg-[var(--surface)]",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent",
                    "w-48"
                  )}
                />
              </div>

              {/* Filtre owner (chip toggles : Tous / Kylian / Lohan) */}
              <div className="inline-flex border border-[var(--border)] bg-[var(--surface)] p-0.5">
                <button
                  type="button"
                  onClick={() => setOwnerFilter(null)}
                  className={cn(
                    "h-6 px-2 text-[11px] transition-colors",
                    ownerFilter === null
                      ? "bg-accent/15 text-accent"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tous
                </button>
                {TO_CONTACT_OWNERS.map((owner) => (
                  <button
                    key={owner.email}
                    type="button"
                    onClick={() => setOwnerFilter(owner.email)}
                    className={cn(
                      "h-6 px-2 text-[11px] transition-colors inline-flex items-center gap-1"
                    )}
                    style={
                      ownerFilter === owner.email
                        ? { color: owner.accent, background: `${owner.accent}20` }
                        : undefined
                    }
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: owner.accent }}
                    />
                    {owner.shortName}
                  </button>
                ))}
              </div>

              {/* Filtre quality top */}
              <button
                type="button"
                onClick={() => setTopQualityOnly((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1 h-7 px-2.5 text-xs border transition-colors",
                  topQualityOnly
                    ? "border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10"
                    : "border-[var(--border)] text-muted-foreground hover:text-foreground"
                )}
                title="Filtrer sur les leads avec quality_score ≥ 80"
              >
                <Star className="h-3.5 w-3.5" />
                Top qualité
              </button>

              {/* Export CSV — leads + deals visibles dans le kanban */}
              <ExportCsvButton
                rows={leads}
                filenamePrefix="leads"
                label="Exporter leads"
                columns={[
                  { header: "Prénom", get: (l) => l.first_name },
                  { header: "Nom", get: (l) => l.last_name },
                  { header: "Email", get: (l) => l.email },
                  { header: "Téléphone", get: (l) => l.phone },
                  { header: "Fonction", get: (l) => l.role },
                  { header: "Entreprise", get: (l) => l.company_name },
                  { header: "Domaine", get: (l) => l.company_domain },
                  { header: "Stage", get: (l) => l.pipeline_stage },
                  { header: "Status", get: (l) => l.status },
                  { header: "Quality", get: (l) => l.quality_score },
                  { header: "Owner", get: (l) => l.assignee?.full_name ?? l.assignee?.email ?? "" },
                  { header: "Prochaine relance", get: (l) => l.next_follow_up_at?.slice(0, 10) ?? "" },
                  { header: "Importé le", get: (l) => formatDate(l.imported_at) },
                ]}
              />
            </>
          )}

          {/* Toggle Bruts — uniquement en vue kanban, masque les leads
              en stage 'brut' pour alléger drastiquement le DOM. */}
          {effectiveView === "kanban" && brutHydrated && brutCount > 0 && (
            <button
              type="button"
              onClick={handleToggleBrut}
              className={cn(
                "inline-flex items-center gap-1.5 h-7 px-2.5 text-xs border transition-colors",
                showBrut
                  ? "border-accent/40 text-accent bg-accent/10 hover:bg-accent/15"
                  : "border-[var(--border)] text-muted-foreground hover:text-foreground hover:border-[var(--muted)]"
              )}
              title={
                showBrut
                  ? "Masquer la colonne Brut"
                  : "Afficher la colonne Brut"
              }
            >
              {showBrut ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {showBrut ? "Masquer les bruts" : "Afficher les bruts"}
              <span className="font-mono tabular-nums">({brutCount})</span>
            </button>
          )}

          {/* Switcher Kanban / Liste — masqué sur mobile : la vue mobile du
              kanban est déjà une liste navigable par colonne, la ListView
              devient redondante et bouffe de l'espace toolbar. */}
          <div className="hidden md:inline-flex border border-[var(--border)] bg-[var(--surface)] p-0.5">
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
          {effectiveView === "kanban" ? (
            <div className="h-full md:overflow-x-auto px-4 md:px-6 pb-6">
              <PipelineKanban
                leads={leads}
                deals={deals}
                profiles={leadProfiles}
                showBrut={showBrut}
                searchQuery={searchQuery}
                ownerProfileId={selectedOwnerProfileId}
                topQualityOnly={topQualityOnly}
                onLeadsChange={handleLeadsChange}
                onDealsChange={handleDealsChange}
                onOpenLead={handleOpenLead}
                onOpenDeal={openEdit}
                onCreateDealInStage={openCreateInStage}
                selectedLeadIds={selectedLeadIds}
                onToggleLeadSelect={toggleLeadSelect}
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

      <LeadDrawer
        lead={openLead}
        companies={companies}
        profiles={leadProfiles}
        onLeadChanged={handleLeadDrawerChanged}
        onOpenChange={(o) => !o && setOpenLead(null)}
        onSuccess={() => {
          setOpenLead(null);
          startTransition(() => router.refresh());
        }}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType="le deal"
        itemName={deleting?.title ?? ""}
        onConfirm={handleDeleteFromList}
      />

      {/* Bulk actions — sticky bottom-centrée, n'apparaît qu'avec ≥1 lead
          sélectionné. Le `router.refresh()` post-action garantit que la DB
          se reflète dans l'UI (les leads dismissed/convertis sortent du
          state via la re-sync useEffect([initialLeads])). */}
      <BulkActionBar
        selectedIds={Array.from(selectedLeadIds)}
        profiles={leadProfiles}
        onClear={clearSelection}
        onDone={() => startTransition(() => router.refresh())}
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
