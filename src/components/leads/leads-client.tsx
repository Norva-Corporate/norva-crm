"use client";
import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  CheckCircle2,
  Sparkles,
  X,
  AlertCircle,
  Mail,
  Building2,
  Clock,
  RotateCcw,
  LayoutGrid,
  List as ListIcon,
  Wand2,
  SlidersHorizontal,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadDrawer } from "@/components/leads/LeadDrawer";
import { LeadsKanban } from "@/components/leads/LeadsKanban";
import {
  dismissLead,
  markLeadAsDuplicate,
  reopenLead,
  type LeadAssignee,
  type LeadWithDedup,
} from "@/lib/actions/leads";
import { AgentButton } from "@/components/agents/agent-button";
import {
  DEFAULT_LEAD_FILTERS,
  DEFAULT_SORT,
  EFFECTIF_FILTER_LABELS,
  EMAIL_FILTER_LABELS,
  QUALITY_FILTER_LABELS,
  SORT_LABELS,
  countActiveFilters,
  matchesFilters,
  sortLeads,
  type EffectifFilter,
  type EmailFilter,
  type LeadFilters,
  type LeadSortBy,
  type QualityFilter,
} from "@/components/leads/lead-filters";
import { formatRelativeDate, cn } from "@/lib/utils";

type ViewMode = "kanban" | "list";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  pending: { label: "À traiter", variant: "default" },
  qualified: { label: "Qualifié", variant: "warning" },
  converted: { label: "Converti", variant: "success" },
  dismissed: { label: "Rejeté", variant: "secondary" },
  duplicate: { label: "Doublon", variant: "warning" },
};

type TabKey = "pending" | "qualified" | "all" | "converted" | "dismissed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "À traiter" },
  { key: "qualified", label: "Qualifiés" },
  { key: "all", label: "Tous" },
  { key: "converted", label: "Convertis" },
  { key: "dismissed", label: "Rejetés" },
];

interface Props {
  leads: LeadWithDedup[];
  companies: { id: string; name: string }[];
  profiles: LeadAssignee[];
}

export function LeadsClient({ leads: initialLeads, companies, profiles }: Props) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("kanban");
  // Local state for optimistic updates (drag & drop)
  const [leads, setLeads] = useState<LeadWithDedup[]>(initialLeads);
  const [tab, setTab] = useState<TabKey>("pending");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_LEAD_FILTERS);
  const [sortBy, setSortBy] = useState<LeadSortBy>(DEFAULT_SORT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<LeadWithDedup | null>(null);
  const [pending, startTransition] = useTransition();

  const activeFilterCount = countActiveFilters(filters);

  // Re-sync when server data changes (after revalidate)
  React.useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const counts = useMemo(() => {
    const c = {
      pending: 0,
      qualified: 0,
      converted: 0,
      dismissed: 0,
      duplicate: 0,
    };
    for (const l of leads) {
      if (l.status === "pending") c.pending++;
      else if (l.status === "qualified") c.qualified++;
      else if (l.status === "converted") c.converted++;
      else if (l.status === "dismissed") c.dismissed++;
      else if (l.status === "duplicate") c.duplicate++;
    }
    return c;
  }, [leads]);

  // Filter for the LIST view (respects tab + search + filtres + tri)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchedLeads = leads.filter((l) => {
      const matchesTab =
        tab === "all" ||
        (tab === "pending" && l.status === "pending") ||
        (tab === "qualified" && l.status === "qualified") ||
        (tab === "converted" &&
          (l.status === "converted" || l.status === "duplicate")) ||
        (tab === "dismissed" && l.status === "dismissed");
      const matchesSearch =
        !q ||
        l.email?.toLowerCase().includes(q) ||
        l.first_name?.toLowerCase().includes(q) ||
        l.last_name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.company_domain?.toLowerCase().includes(q);
      return matchesTab && matchesSearch && matchesFilters(l, filters);
    });
    return sortLeads(matchedLeads, sortBy);
  }, [leads, tab, search, filters, sortBy]);

  // Leads for the KANBAN view : tous les non-terminaux (pending + qualified)
  // Les converted/dismissed/duplicate sortent du kanban (états terminaux)
  const kanbanLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchedLeads = leads.filter((l) => {
      if (l.status !== "pending" && l.status !== "qualified") return false;
      const matchesSearch =
        !q ||
        l.email?.toLowerCase().includes(q) ||
        l.first_name?.toLowerCase().includes(q) ||
        l.last_name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.company_domain?.toLowerCase().includes(q);
      return matchesSearch && matchesFilters(l, filters);
    });
    return sortLeads(matchedLeads, sortBy);
  }, [leads, search, filters, sortBy]);

  // Keep `selected` in sync with the latest data
  React.useEffect(() => {
    if (!selected) return;
    const fresh = leads.find((l) => l.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [leads, selected]);

  const handleDismiss = (lead: LeadWithDedup) => {
    startTransition(async () => {
      await dismissLead(lead.id);
      router.refresh();
    });
  };

  const handleMarkDuplicate = (lead: LeadWithDedup) => {
    if (!lead.existing_contact_id) return;
    startTransition(async () => {
      await markLeadAsDuplicate(lead.id, lead.existing_contact_id!);
      router.refresh();
    });
  };

  const handleReopen = (lead: LeadWithDedup) => {
    startTransition(async () => {
      await reopenLead(lead.id);
      router.refresh();
    });
  };

  return (
    <>
      <Header title="Leads" />

      <div className="flex-1 p-6 animate-fade-in space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="À traiter" value={counts.pending} accent="#3B7BF5" />
          <KPI label="Qualifiés" value={counts.qualified} accent="#F59E0B" />
          <KPI label="Convertis" value={counts.converted} accent="#22C55E" />
          <KPI label="Doublons" value={counts.duplicate} accent="#F59E0B" />
          <KPI label="Rejetés" value={counts.dismissed} />
        </div>

        {/* Toolbar : search + view toggle + filtres + tri + tabs (mode liste) */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher email, nom, entreprise…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* View toggle */}
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
              icon={<ListIcon className="h-3.5 w-3.5" />}
              label="Liste"
            />
          </div>

          {/* Bouton "Filtres" avec compteur actif */}
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "h-8 px-2.5 inline-flex items-center gap-1.5 text-xs border transition-colors",
              filtersOpen || activeFilterCount > 0
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-[var(--border)] text-muted-foreground hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtres
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center bg-accent text-white text-[9px] font-mono h-4 min-w-4 px-1 rounded-sm tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Tri */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as LeadSortBy)}
            className="h-8 px-2 text-xs bg-[var(--surface)] border border-[var(--border)] text-foreground focus:outline-none focus:border-accent/40"
          >
            {(Object.keys(SORT_LABELS) as LeadSortBy[]).map((k) => (
              <option key={k} value={k}>
                Tri : {SORT_LABELS[k]}
              </option>
            ))}
          </select>

          {/* Tabs (mode liste seulement) */}
          {view === "list" && (
            <div className="flex gap-1.5 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "text-xs px-2.5 py-1 transition-colors rounded-sm",
                    tab === t.key
                      ? "bg-accent text-white"
                      : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filtres dropdown */}
        {filtersOpen && (
          <div className="flex items-center gap-3 flex-wrap p-3 bg-[var(--surface)] border border-[var(--border)]">
            <FilterSelect
              label="Qualité"
              value={filters.quality}
              onChange={(v) =>
                setFilters({ ...filters, quality: v as QualityFilter })
              }
              options={QUALITY_FILTER_LABELS}
            />
            <FilterSelect
              label="Email"
              value={filters.email}
              onChange={(v) =>
                setFilters({ ...filters, email: v as EmailFilter })
              }
              options={EMAIL_FILTER_LABELS}
            />
            <FilterSelect
              label="Effectif"
              value={filters.effectif}
              onChange={(v) =>
                setFilters({ ...filters, effectif: v as EffectifFilter })
              }
              options={EFFECTIF_FILTER_LABELS}
            />
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_LEAD_FILTERS)}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 ml-auto"
              >
                <X className="h-3 w-3" />
                Réinitialiser
              </button>
            )}
          </div>
        )}

        {/* Vue */}
        {view === "kanban" ? (
          <div className="overflow-x-auto -mx-6 px-6 pb-4">
            {kanbanLeads.length === 0 ? (
              <Card className="px-4 py-12 text-center text-sm text-muted-foreground">
                {leads.length === 0 ? (
                  <>Aucun lead pour le moment. Tes agents multica vont remplir cette liste.</>
                ) : (
                  <>Aucun lead actif ne correspond à la recherche.</>
                )}
              </Card>
            ) : (
              <LeadsKanban
                leads={kanbanLeads}
                onLeadsChange={(updater) => setLeads(updater)}
                onOpenLead={setSelected}
              />
            )}
          </div>
        ) : (
          <Card className="overflow-hidden">
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                {leads.length === 0 ? (
                  <>Aucun lead pour le moment. Tes agents multica vont remplir cette liste.</>
                ) : (
                  <>Aucun lead ne correspond aux filtres.</>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {filtered.map((lead) => {
                  const sc = STATUS_CONFIG[lead.status];
                  const fullName =
                    [lead.first_name, lead.last_name]
                      .filter(Boolean)
                      .join(" ") || "(Sans nom)";
                  const isPending = lead.status === "pending";
                  const isQualified = lead.status === "qualified";
                  const canConvert = isPending || isQualified;
                  return (
                    <li
                      key={lead.id}
                      onClick={() => setSelected(lead)}
                      className="flex items-start gap-4 px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-accent mt-1 shrink-0" />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">
                            {fullName}
                          </p>
                          {lead.role && (
                            <span className="text-[11px] text-muted-foreground">
                              {lead.role}
                            </span>
                          )}
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                          {lead.existing_contact_id && isPending && (
                            <span
                              title="Un contact avec cet email existe déjà"
                              className="inline-flex items-center gap-1 text-[10px] text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 px-1.5 py-0.5 rounded-sm"
                            >
                              <AlertCircle className="h-2.5 w-2.5" />
                              Doublon possible :{" "}
                              <Link
                                href={`/dashboard/contacts/${lead.existing_contact_id}`}
                                className="underline hover:text-[#F59E0B]/80"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lead.existing_contact_name}
                              </Link>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                          {lead.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          )}
                          {lead.company_name && (
                            <span className="inline-flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {lead.company_name}
                              {lead.existing_company_id && (
                                <span className="ml-1 text-[10px] text-accent">
                                  (déjà en base)
                                </span>
                              )}
                            </span>
                          )}
                          {lead.company_domain && (
                            <span className="font-mono">{lead.company_domain}</span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeDate(lead.imported_at)}
                          </span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canConvert ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setSelected(lead)}
                              disabled={pending}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ouvrir
                            </Button>
                            <AgentButton
                              agent="enrichissement"
                              entityType="lead_import"
                              entityId={lead.id}
                              shortLabel=""
                              icon={Wand2}
                              successMessage="Enrichissement en file. Lance l'agent dans multica."
                            />
                            {lead.existing_contact_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkDuplicate(lead)}
                                disabled={pending}
                                title="Marquer comme doublon"
                              >
                                <AlertCircle className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDismiss(lead)}
                              disabled={pending}
                              title="Rejeter"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            {lead.contact_id && (
                              <Link
                                href={`/dashboard/contacts/${lead.contact_id}`}
                                className="text-[11px] text-accent hover:underline"
                              >
                                Voir contact →
                              </Link>
                            )}
                            {(lead.status === "dismissed" ||
                              lead.status === "duplicate") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReopen(lead)}
                                disabled={pending}
                                title="Rouvrir"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </div>

      <LeadDrawer
        lead={selected}
        companies={companies}
        profiles={profiles}
        onOpenChange={(o) => !o && setSelected(null)}
        onSuccess={() => {
          setSelected(null);
          startTransition(() => router.refresh());
        }}
      />
    </>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className="text-xl font-bold font-mono"
        style={accent ? { color: accent } : { color: "var(--foreground)" }}
      >
        {value}
      </p>
    </Card>
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

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Record<T, string>;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <label className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-7 px-2 text-xs bg-[var(--background)] border border-[var(--border)] text-foreground focus:outline-none focus:border-accent/40"
      >
        {(Object.keys(options) as T[]).map((k) => (
          <option key={k} value={k}>
            {options[k]}
          </option>
        ))}
      </select>
    </div>
  );
}
