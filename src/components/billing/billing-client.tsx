"use client";
import React, { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Loader2, Pencil, Trash2, Plus, Minus, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { InvoiceStatus, DocumentType } from "@/types";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; variant: any }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  sent: { label: "Envoyé", variant: "default" },
  paid: { label: "Payé", variant: "success" },
  overdue: { label: "En retard", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "secondary" },
};

interface LineItem {
  description: string;
  quantity: string;
  unit_price: string;
}

interface InvoiceForm {
  type: DocumentType;
  status: InvoiceStatus;
  project_id: string;
  contact_id: string;
  company_id: string;
  issue_date: string;
  due_date: string;
  tax_rate: string;
  notes: string;
  items: LineItem[];
}

const defaultForm: InvoiceForm = {
  type: "invoice",
  status: "draft",
  project_id: "",
  contact_id: "",
  company_id: "",
  issue_date: new Date().toISOString().split("T")[0],
  due_date: "",
  tax_rate: "20",
  notes: "",
  items: [{ description: "", quantity: "1", unit_price: "" }],
};

interface Props {
  initialInvoices: any[];
  projects: { id: string; name: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
}

export function BillingClient({ initialInvoices, projects, contacts, companies }: Props) {
  const [invoices, setInvoices] = useState<any[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<InvoiceForm>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const subtotal = useMemo(
    () =>
      form.items.reduce(
        (s, item) =>
          s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
        0
      ),
    [form.items]
  );
  const taxAmount = subtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const total = subtotal + taxAmount;

  const filtered = useMemo(
    () =>
      invoices.filter((inv) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          inv.number.toLowerCase().includes(q) ||
          inv.contact?.first_name?.toLowerCase().includes(q) ||
          inv.contact?.last_name?.toLowerCase().includes(q) ||
          inv.company?.name?.toLowerCase().includes(q);
        const matchesType = typeFilter === "all" || inv.type === typeFilter;
        const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
      }),
    [invoices, search, typeFilter, statusFilter]
  );

  function openCreate() {
    setEditing(null);
    setForm(defaultForm);
    setIsOpen(true);
  }

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addItem() {
    setForm((f) => ({
      ...f,
      items: [...f.items, { description: "", quantity: "1", unit_price: "" }],
    }));
  }

  function removeItem(idx: number) {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  }

  async function handleSave() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const invoicePayload = {
      type: form.type,
      status: form.status,
      project_id: form.project_id || null,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      tax_rate: parseFloat(form.tax_rate) || 0,
      tax_amount: taxAmount,
      subtotal,
      total,
      notes: form.notes || null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from("invoices")
        .update(invoicePayload)
        .eq("id", editing.id)
        .select("*, project:projects(id, name), contact:contacts(id, first_name, last_name), company:companies(id, name)")
        .single();

      if (!error && data) {
        // Re-insert items
        await supabase.from("invoice_items").delete().eq("invoice_id", editing.id);
        if (form.items.length > 0) {
          await supabase.from("invoice_items").insert(
            form.items.map((item, idx) => ({
              invoice_id: editing.id,
              description: item.description,
              quantity: parseFloat(item.quantity) || 1,
              unit_price: parseFloat(item.unit_price) || 0,
              total: (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0),
              sort_order: idx,
            }))
          );
        }
        setInvoices((prev) => prev.map((inv) => (inv.id === editing.id ? data : inv)));
      }
    } else {
      // Generate number via RPC
      const { data: numData } = await supabase.rpc("generate_invoice_number", {
        doc_type: form.type,
      });

      const { data, error } = await supabase
        .from("invoices")
        .insert({ ...invoicePayload, number: numData, created_by: user!.id })
        .select("*, project:projects(id, name), contact:contacts(id, first_name, last_name), company:companies(id, name)")
        .single();

      if (!error && data) {
        if (form.items.length > 0) {
          await supabase.from("invoice_items").insert(
            form.items.map((item, idx) => ({
              invoice_id: data.id,
              description: item.description,
              quantity: parseFloat(item.quantity) || 1,
              unit_price: parseFloat(item.unit_price) || 0,
              total: (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_price) || 0),
              sort_order: idx,
            }))
          );
        }
        setInvoices((prev) => [data, ...prev]);
      }
    }

    setLoading(false);
    setIsOpen(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("invoices").delete().eq("id", id);
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    setDeleteId(null);
  }

  const totalRevenue = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0);
  const totalPending = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <>
      <Header title="Facturation" action={{ label: "Nouveau document", onClick: openCreate }} />

      <div className="flex-1 p-6 animate-fade-in space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "CA encaissé", value: formatCurrency(totalRevenue), color: "text-success" },
            { label: "En attente", value: formatCurrency(totalPending), color: "text-warning" },
            { label: "Total documents", value: invoices.length.toString(), color: "text-foreground" },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex gap-1.5">
            {["all", "invoice", "quote"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs px-2.5 py-1 transition-colors ${
                  typeFilter === t ? "bg-accent text-white" : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "all" ? "Tous" : t === "invoice" ? "Factures" : "Devis"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {["all", "draft", "sent", "paid", "overdue"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2.5 py-1 transition-colors ${
                  statusFilter === s ? "bg-accent text-white" : "bg-[var(--muted)] text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "Tous" : STATUS_CONFIG[s as InvoiceStatus]?.label ?? s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Numéro</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date émission</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Échéance</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Statut</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Montant</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Aucun document.{" "}
                      <button onClick={openCreate} className="text-accent hover:underline">Créer le premier</button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-accent" />
                          <span className="text-sm font-mono text-foreground">{inv.number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {inv.type === "invoice" ? "Facture" : "Devis"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">
                          {inv.contact
                            ? `${inv.contact.first_name} ${inv.contact.last_name}`
                            : inv.company?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{formatDate(inv.issue_date)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_CONFIG[inv.status as InvoiceStatus]?.variant ?? "secondary"}>
                          {STATUS_CONFIG[inv.status as InvoiceStatus]?.label ?? inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(inv.total)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditing(inv);
                              setForm({
                                type: inv.type,
                                status: inv.status,
                                project_id: inv.project_id ?? "",
                                contact_id: inv.contact_id ?? "",
                                company_id: inv.company_id ?? "",
                                issue_date: inv.issue_date,
                                due_date: inv.due_date ?? "",
                                tax_rate: inv.tax_rate?.toString() ?? "20",
                                notes: inv.notes ?? "",
                                items: [{ description: "", quantity: "1", unit_price: "" }],
                              });
                              setIsOpen(true);
                            }}>
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteId(inv.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Invoice Form */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le document" : "Nouveau document"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as DocumentType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Facture</SelectItem>
                    <SelectItem value="quote">Devis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as InvoiceStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>TVA (%)</Label>
                <Input
                  type="number"
                  value={form.tax_rate}
                  onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date d'émission</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Date d'échéance</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Projet</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={(v) => setForm((f) => ({ ...f, contact_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Entreprise</Label>
                <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucune</SelectItem>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Lignes</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3" />
                  Ajouter
                </Button>
              </div>
              <div className="border border-[var(--border)]">
                <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <span className="text-xs text-muted-foreground text-center">Qté</span>
                  <span className="text-xs text-muted-foreground text-center">P.U. HT</span>
                  <span className="text-xs text-muted-foreground text-right">Total HT</span>
                  <span />
                </div>
                {form.items.map((item, idx) => {
                  const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-0 border-b border-[var(--border)] last:border-b-0">
                      <input
                        className="px-3 py-2 text-xs bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-[var(--muted)]/20 border-r border-[var(--border)]"
                        placeholder="Description..."
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                      />
                      <input
                        className="px-3 py-2 text-xs bg-transparent text-foreground text-center placeholder:text-muted-foreground focus:outline-none focus:bg-[var(--muted)]/20 border-r border-[var(--border)]"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      />
                      <input
                        className="px-3 py-2 text-xs bg-transparent text-foreground text-center placeholder:text-muted-foreground focus:outline-none focus:bg-[var(--muted)]/20 border-r border-[var(--border)]"
                        type="number"
                        placeholder="0.00"
                        value={item.unit_price}
                        onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                      />
                      <span className="px-3 py-2 text-xs text-foreground text-right flex items-center justify-end border-r border-[var(--border)]">
                        {formatCurrency(lineTotal)}
                      </span>
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={form.items.length === 1}
                        className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="mt-3 space-y-1 text-right">
                <p className="text-xs text-muted-foreground">
                  Sous-total HT : <span className="text-foreground font-medium">{formatCurrency(subtotal)}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  TVA ({form.tax_rate}%) : <span className="text-foreground font-medium">{formatCurrency(taxAmount)}</span>
                </p>
                <p className="text-sm font-bold text-foreground">
                  Total TTC : {formatCurrency(total)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer le document</DialogTitle></DialogHeader>
          <p className="px-6 pb-2 text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
