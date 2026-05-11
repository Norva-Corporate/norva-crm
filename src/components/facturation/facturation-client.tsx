"use client";
import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceDrawer } from "@/components/facturation/InvoiceDrawer";
import { DeleteModal } from "@/components/contacts/DeleteModal";
import { deleteInvoice } from "@/lib/actions/invoices";
import {
  formatCurrency,
  formatDate,
  cn,
  getEffectiveInvoiceStatus,
} from "@/lib/utils";
import type { Invoice, InvoiceStatus, DocumentType } from "@/types";

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }
> = {
  brouillon: { label: "Brouillon", variant: "secondary" },
  envoyee: { label: "Envoyée", variant: "default" },
  payee: { label: "Payée", variant: "success" },
  en_retard: { label: "En retard", variant: "destructive" },
  annulee: { label: "Annulée", variant: "secondary" },
};

const STATUS_FILTERS: { key: "all" | InvoiceStatus; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "brouillon", label: "Brouillon" },
  { key: "envoyee", label: "Envoyée" },
  { key: "payee", label: "Payée" },
  { key: "en_retard", label: "En retard" },
  { key: "annulee", label: "Annulée" },
];

const TYPE_FILTERS: { key: "all" | DocumentType; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "invoice", label: "Factures" },
  { key: "quote", label: "Devis" },
];

type InvoiceRow = Invoice & {
  project: { id: string; name: string } | null;
  contact: { id: string; first_name: string; last_name: string } | null;
  company: { id: string; name: string } | null;
};

interface Props {
  initialInvoices: InvoiceRow[];
  projects: { id: string; name: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
}

export function FacturationClient({
  initialInvoices,
  projects,
  contacts,
  companies,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvoiceStatus>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | DocumentType>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);
  const [, startTransition] = useTransition();

  const withEffective = useMemo(
    () =>
      initialInvoices.map((inv) => ({
        ...inv,
        effective_status: getEffectiveInvoiceStatus(inv),
      })),
    [initialInvoices]
  );

  const stats = useMemo(() => {
    const actives = withEffective.filter(
      (i) => i.type === "invoice" && i.effective_status !== "annulee"
    );
    const totalFacture = actives.reduce((s, i) => s + (i.total ?? 0), 0);
    const encaisse = actives
      .filter((i) => i.effective_status === "payee")
      .reduce((s, i) => s + (i.total ?? 0), 0);
    const enAttente = actives
      .filter((i) => i.effective_status === "envoyee")
      .reduce((s, i) => s + (i.total ?? 0), 0);
    const enRetard = actives
      .filter((i) => i.effective_status === "en_retard")
      .reduce((s, i) => s + (i.total ?? 0), 0);
    return { totalFacture, encaisse, enAttente, enRetard };
  }, [withEffective]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withEffective.filter((inv) => {
      const matchesSearch =
        !q ||
        inv.number.toLowerCase().includes(q) ||
        inv.project?.name?.toLowerCase().includes(q) ||
        inv.contact?.first_name?.toLowerCase().includes(q) ||
        inv.contact?.last_name?.toLowerCase().includes(q) ||
        inv.company?.name?.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || inv.type === typeFilter;
      const matchesStatus =
        statusFilter === "all" || inv.effective_status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [withEffective, search, typeFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(invoice: InvoiceRow) {
    setEditing(invoice);
    setDrawerOpen(true);
  }

  function handleDelete() {
    if (!deleting) return Promise.resolve({ success: true } as const);
    return deleteInvoice(deleting.id).then((res) => {
      if (res.success) {
        startTransition(() => router.refresh());
      }
      return res;
    });
  }

  function handleSuccess() {
    startTransition(() => router.refresh());
  }

  return (
    <>
      <Header
        title="Facturation"
        action={{ label: "Nouveau document", onClick: openCreate }}
      />

      <div className="flex-1 p-4 md:p-6 animate-fade-in space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Total facturé" value={formatCurrency(stats.totalFacture)} />
          <KPI
            label="Encaissé"
            value={formatCurrency(stats.encaisse)}
            accent="#22C55E"
          />
          <KPI
            label="En attente"
            value={formatCurrency(stats.enAttente)}
            accent="#3B7BF5"
          />
          <KPI
            label="En retard"
            value={formatCurrency(stats.enRetard)}
            accent="#EF4444"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="relative w-full sm:flex-1 sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={cn(
                  "text-xs px-2.5 py-1 transition-colors rounded-sm",
                  typeFilter === f.key
                    ? "bg-accent text-white"
                    : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "text-xs px-2.5 py-1 transition-colors rounded-sm",
                  statusFilter === f.key
                    ? "bg-accent text-white"
                    : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile : liste de cartes */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 ? (
            <Card className="px-4 py-12 text-center text-sm text-muted-foreground">
              <FileText className="h-6 w-6 mx-auto mb-2 text-muted-foreground/60" />
              Aucun document.{" "}
              <button onClick={openCreate} className="text-accent hover:underline">
                Créer le premier
              </button>
            </Card>
          ) : (
            filtered.map((inv) => {
              const sc = STATUS_CONFIG[inv.effective_status];
              const clientLabel = inv.contact
                ? `${inv.contact.first_name} ${inv.contact.last_name}`
                : inv.company?.name ?? "—";
              return (
                <Card
                  key={inv.id}
                  onClick={() =>
                    router.push(`/dashboard/facturation/${inv.id}`)
                  }
                  className={cn(
                    "p-3 cursor-pointer hover:border-accent/30 transition-colors",
                    inv.effective_status === "annulee" && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono text-foreground">
                          {inv.number}
                        </span>
                        {inv.type === "quote" && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[var(--muted)] text-muted-foreground rounded-sm">
                            DEVIS
                          </span>
                        )}
                        <Badge variant={sc.variant} className="text-[10px]">
                          {sc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground mt-1 truncate">
                        {clientLabel}
                      </p>
                      {inv.project?.name && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {inv.project.name}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-sm font-semibold text-foreground font-mono">
                          {formatCurrency(inv.total ?? 0)}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatDate(inv.due_date)}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(inv)}>
                          <Pencil className="h-3.5 w-3.5" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(inv)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Desktop : tableau */}
        <Card className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <Th>Numéro</Th>
                  <Th>Client</Th>
                  <Th>Projet</Th>
                  <Th align="right">Montant</Th>
                  <Th>Statut</Th>
                  <Th>Échéance</Th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      Aucun document.{" "}
                      <button
                        onClick={openCreate}
                        className="text-accent hover:underline"
                      >
                        Créer le premier
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => {
                    const sc = STATUS_CONFIG[inv.effective_status];
                    return (
                      <tr
                        key={inv.id}
                        onClick={() =>
                          router.push(`/dashboard/facturation/${inv.id}`)
                        }
                        className={cn(
                          "border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--muted)]/20 transition-colors cursor-pointer",
                          inv.effective_status === "annulee" && "opacity-50"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-accent" />
                            <span className="text-sm font-mono text-foreground">
                              {inv.number}
                            </span>
                            {inv.type === "quote" && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--muted)] text-muted-foreground rounded-sm">
                                DEVIS
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-foreground truncate block max-w-[180px]">
                            {inv.contact
                              ? `${inv.contact.first_name} ${inv.contact.last_name}`
                              : inv.company?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground truncate block max-w-[180px]">
                            {inv.project?.name ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-foreground font-mono">
                            {formatCurrency(inv.total ?? 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={sc.variant}>{sc.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatDate(inv.due_date)}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(inv)}>
                                <Pencil className="h-3.5 w-3.5" />
                                Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleting(inv)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <InvoiceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        invoice={editing as InvoiceRow | null}
        projects={projects}
        contacts={contacts}
        companies={companies}
        onSuccess={handleSuccess}
      />

      <DeleteModal
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        itemType={deleting?.type === "quote" ? "le devis" : "la facture"}
        itemName={deleting?.number ?? ""}
        description="Toutes les lignes du document seront également supprimées."
        onConfirm={handleDelete}
      />
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-xs font-medium text-muted-foreground",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

function KPI({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className="text-xl font-bold font-mono truncate"
        style={accent ? { color: accent } : { color: "var(--foreground)" }}
      >
        {value}
      </p>
    </Card>
  );
}
