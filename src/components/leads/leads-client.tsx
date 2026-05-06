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
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConvertLeadDrawer } from "@/components/leads/ConvertLeadDrawer";
import {
  dismissLead,
  markLeadAsDuplicate,
  reopenLead,
  type LeadWithDedup,
} from "@/lib/actions/leads";
import { formatRelativeDate, cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  pending: { label: "À traiter", variant: "default" },
  converted: { label: "Converti", variant: "success" },
  dismissed: { label: "Rejeté", variant: "secondary" },
  duplicate: { label: "Doublon", variant: "warning" },
};

const TABS: { key: "pending" | "all" | "converted" | "dismissed"; label: string }[] = [
  { key: "pending", label: "À traiter" },
  { key: "all", label: "Tous" },
  { key: "converted", label: "Convertis" },
  { key: "dismissed", label: "Rejetés" },
];

interface Props {
  leads: LeadWithDedup[];
  companies: { id: string; name: string }[];
}

export function LeadsClient({ leads, companies }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "all" | "converted" | "dismissed">(
    "pending"
  );
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<LeadWithDedup | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = { pending: 0, converted: 0, dismissed: 0, duplicate: 0 };
    for (const l of leads) {
      if (l.status === "pending") c.pending++;
      else if (l.status === "converted") c.converted++;
      else if (l.status === "dismissed") c.dismissed++;
      else if (l.status === "duplicate") c.duplicate++;
    }
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      const matchesTab =
        tab === "all" ||
        (tab === "pending" && l.status === "pending") ||
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
      return matchesTab && matchesSearch;
    });
  }, [leads, tab, search]);

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="À traiter" value={counts.pending} accent="#3B7BF5" />
          <KPI label="Convertis" value={counts.converted} accent="#22C55E" />
          <KPI label="Doublons" value={counts.duplicate} accent="#F59E0B" />
          <KPI label="Rejetés" value={counts.dismissed} />
        </div>

        {/* Tabs + search */}
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
        </div>

        {/* List */}
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
                return (
                  <li
                    key={lead.id}
                    className="flex items-start gap-4 px-4 py-3 hover:bg-[var(--muted)]/20 transition-colors"
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

                    <div className="flex items-center gap-2 shrink-0">
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => setConverting(lead)}
                            disabled={pending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Convertir
                          </Button>
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
      </div>

      <ConvertLeadDrawer
        lead={converting}
        companies={companies}
        onOpenChange={(o) => !o && setConverting(null)}
        onSuccess={() => {
          setConverting(null);
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
