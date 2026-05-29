"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileSignature, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContratStatutBadge } from "@/components/contrats/ContratStatutBadge";
import {
  GenerateContratDialog,
  type CompanyOption,
  type ContactOption,
} from "@/components/contrats/GenerateContratDialog";
import { useContratsRealtime } from "@/hooks/use-contrats-realtime";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDate } from "@/lib/utils";
import type { Contrat } from "@/types";

export type ContratsSectionScope =
  | { type: "deal"; id: string }
  | { type: "contact"; id: string }
  | { type: "all" };

interface Props {
  scope: ContratsSectionScope;
  className?: string;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  }).format(n);
}

function computeNextRef(existing: Contrat[]): string {
  const year = new Date().getFullYear();
  const prefix = `NC-${year}-`;
  const used = existing
    .map((c) => c.ref)
    .filter((r) => r.startsWith(prefix))
    .map((r) => Number(r.slice(prefix.length)))
    .filter((n) => Number.isFinite(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

export function ContratsSection({ scope, className }: Props) {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchContrats = useCallback(async () => {
    const supabase = createClient();
    let q = supabase
      .from("contrats")
      .select("*")
      .order("created_at", { ascending: false });
    if (scope.type === "deal") q = q.eq("deal_id", scope.id);
    if (scope.type === "contact") q = q.eq("contact_id", scope.id);
    const { data, error } = await q;
    if (error) {
      console.error("[ContratsSection] fetch error:", error);
      setContrats([]);
    } else {
      setContrats((data as Contrat[]) ?? []);
    }
    setLoading(false);
  }, [scope.type, scope.type === "all" ? "all" : scope.id]);

  // Charge contacts + companies une fois (pour le dialog)
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: cs }, { data: cos }] = await Promise.all([
        supabase
          .from("contacts")
          .select("id, first_name, last_name, email, phone, company_id")
          .order("last_name", { ascending: true })
          .limit(500),
        supabase
          .from("companies")
          .select("id, name, phone, address")
          .order("name", { ascending: true })
          .limit(500),
      ]);
      setContacts((cs as ContactOption[]) ?? []);
      setCompanies((cos as CompanyOption[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    fetchContrats();
  }, [fetchContrats]);

  useContratsRealtime(scope, {
    onInsert: () => fetchContrats(),
    onUpdate: () => fetchContrats(),
    onDelete: () => fetchContrats(),
  });

  const defaultRef = useMemo(() => computeNextRef(contrats), [contrats]);
  const defaultDealId = scope.type === "deal" ? scope.id : null;
  const defaultContactId = scope.type === "contact" ? scope.id : null;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
            Contrats
            {contrats.length > 0 && (
              <span className="ml-2 text-foreground">{contrats.length}</span>
            )}
          </h3>
        </div>
        <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Générer
        </Button>
      </div>

      {loading ? (
        <div className="border border-[var(--border)] p-4 text-xs text-muted-foreground">
          Chargement…
        </div>
      ) : contrats.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] p-4 text-xs text-muted-foreground">
          Aucun contrat pour le moment.
        </div>
      ) : (
        <ul className="space-y-2">
          {contrats.map((c) => (
            <ContratRow key={c.id} contrat={c} />
          ))}
        </ul>
      )}

      <GenerateContratDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contacts={contacts}
        companies={companies}
        defaultRef={defaultRef}
        defaultDealId={defaultDealId}
        defaultContactId={defaultContactId}
        onSent={() => fetchContrats()}
      />
    </section>
  );
}

function ContratRow({ contrat }: { contrat: Contrat }) {
  const dateLabel =
    contrat.statut === "signe" && contrat.signed_at
      ? `Signé le ${formatDate(contrat.signed_at)}`
      : contrat.statut === "envoye" && contrat.sent_at
      ? `Envoyé le ${formatDate(contrat.sent_at)}`
      : `Créé le ${formatDate(contrat.created_at)}`;

  return (
    <li className="border border-[var(--border)] bg-[var(--card)] p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-foreground">
              {contrat.ref}
            </span>
            <ContratStatutBadge statut={contrat.statut} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {contrat.client_snapshot?.raison_sociale ?? "—"} ·{" "}
            {fmtMoney(Number(contrat.montant_total))} HT
          </div>
          <div className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground mt-1">
            {dateLabel}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {contrat.pdf_path && (
          <DownloadLink href={`/api/contrats/${contrat.id}/pdf`} label="PDF" />
        )}
        {contrat.signed_pdf_path && (
          <DownloadLink
            href={`/api/contrats/${contrat.id}/signed-pdf`}
            label="PDF signé"
            highlight
          />
        )}
        {contrat.proof_path && (
          <DownloadLink
            href={`/api/contrats/${contrat.id}/proof`}
            label="Preuve"
          />
        )}
      </div>
    </li>
  );
}

function DownloadLink({
  href,
  label,
  highlight,
}: {
  href: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs px-2 py-1 border transition-colors",
        highlight
          ? "border-success/40 text-success bg-success/10 hover:bg-success/15"
          : "border-[var(--border)] text-muted-foreground hover:text-foreground"
      )}
    >
      {highlight ? (
        <ExternalLink className="h-3 w-3" />
      ) : (
        <Download className="h-3 w-3" />
      )}
      {label}
    </a>
  );
}
