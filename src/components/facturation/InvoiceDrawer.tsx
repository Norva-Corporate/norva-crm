"use client";
import React, { useEffect, useMemo, useState, useTransition } from "react";
import {
  ResponsiveDrawer,
  ResponsiveDrawerHeader as DrawerHeader,
  ResponsiveDrawerBody as DrawerBody,
  ResponsiveDrawerFooter as DrawerFooter,
  ResponsiveDrawerTitle as DrawerTitle,
  ResponsiveDrawerDescription as DrawerDescription,
} from "@/components/ui/responsive-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  createInvoice,
  updateInvoice,
  type InvoiceInput,
  type InvoiceItemInput,
} from "@/lib/actions/invoices";
import { invoiceStatuses } from "@/lib/statuses";
import type { DocumentType, Invoice, InvoiceStatus } from "@/types";

const NO_VALUE = "__none__";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  brouillon: invoiceStatuses.brouillon.label,
  envoyee: invoiceStatuses.envoyee.label,
  payee: invoiceStatuses.payee.label,
  en_retard: invoiceStatuses.en_retard.label,
  annulee: invoiceStatuses.annulee.label,
};

interface InvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: (Invoice & { items?: { description: string; quantity: number; unit_price: number }[] }) | null;
  projects: { id: string; name: string }[];
  contacts: { id: string; first_name: string; last_name: string }[];
  companies: { id: string; name: string }[];
  defaultProjectId?: string;
  onSuccess?: (id?: string) => void;
}

interface LineItemForm {
  description: string;
  quantity: string;
  unit_price: string;
}

interface FormState {
  type: DocumentType;
  status: InvoiceStatus;
  number: string;
  project_id: string;
  contact_id: string;
  company_id: string;
  issue_date: string;
  due_date: string;
  tax_rate: string;
  notes: string;
  items: LineItemForm[];
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function emptyForm(defaultProjectId?: string): FormState {
  return {
    type: "invoice",
    status: "brouillon",
    number: "",
    project_id: defaultProjectId ?? "",
    contact_id: "",
    company_id: "",
    issue_date: todayISO(),
    due_date: "",
    tax_rate: "20",
    notes: "",
    items: [{ description: "", quantity: "1", unit_price: "" }],
  };
}

export function InvoiceDrawer({
  open,
  onOpenChange,
  invoice,
  projects,
  contacts,
  companies,
  defaultProjectId,
  onSuccess,
}: InvoiceDrawerProps) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultProjectId));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!invoice;

  useEffect(() => {
    if (open) {
      setError(null);
      if (invoice) {
        setForm({
          type: invoice.type,
          status: invoice.status,
          number: invoice.number ?? "",
          project_id: invoice.project_id ?? "",
          contact_id: invoice.contact_id ?? "",
          company_id: invoice.company_id ?? "",
          issue_date: invoice.issue_date,
          due_date: invoice.due_date ?? "",
          tax_rate: String(invoice.tax_rate ?? 20),
          notes: invoice.notes ?? "",
          items:
            invoice.items && invoice.items.length > 0
              ? invoice.items.map((it) => ({
                  description: it.description ?? "",
                  quantity: String(it.quantity ?? 1),
                  unit_price: String(it.unit_price ?? 0),
                }))
              : [{ description: "", quantity: "1", unit_price: "" }],
        });
      } else {
        setForm(emptyForm(defaultProjectId));
      }
    }
  }, [open, invoice, defaultProjectId]);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce(
      (s, it) =>
        s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0),
      0
    );
    const rate = parseFloat(form.tax_rate) || 0;
    const tax = subtotal * (rate / 100);
    return { subtotal, tax, total: subtotal + tax };
  }, [form.items, form.tax_rate]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateItem(idx: number, key: keyof LineItemForm, value: string) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) =>
        i === idx ? { ...it, [key]: value } : it
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const items: InvoiceItemInput[] = form.items
      .filter((it) => it.description.trim().length > 0)
      .map((it) => ({
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 0,
        unit_price: parseFloat(it.unit_price) || 0,
      }));

    const payload: InvoiceInput = {
      type: form.type,
      status: form.status,
      number: form.number.trim() || null,
      project_id: form.project_id || null,
      contact_id: form.contact_id || null,
      company_id: form.company_id || null,
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      tax_rate: parseFloat(form.tax_rate) || 0,
      notes: form.notes || null,
      items,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateInvoice(invoice!.id, payload)
        : await createInvoice(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      onSuccess?.(
        isEdit ? undefined : (result.data as { id: string } | null)?.id
      );
    });
  }

  const canSubmit =
    form.items.some((it) => it.description.trim().length > 0) &&
    !!form.issue_date;

  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      className="sm:w-[640px]"
    >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>
              {isEdit ? "Modifier le document" : "Nouveau document"}
            </DrawerTitle>
            <DrawerDescription>
              {isEdit
                ? "Mettez à jour la facture ou le devis."
                : "Créez une facture ou un devis. Le numéro est généré automatiquement si laissé vide."}
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setField("type", v as DocumentType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invoice">Facture</SelectItem>
                      <SelectItem value="quote">Devis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Statut</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setField("status", v as InvoiceStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(STATUS_LABELS) as InvoiceStatus[]
                      ).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>TVA (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={form.tax_rate}
                    onChange={(e) => setField("tax_rate", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Numéro</Label>
                  <Input
                    value={form.number}
                    onChange={(e) => setField("number", e.target.value)}
                    placeholder={
                      form.type === "invoice"
                        ? "Auto : FAC-YYYY-XXXX"
                        : "Auto : DEV-YYYY-XXXX"
                    }
                    disabled={isEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date d'émission *</Label>
                  <Input
                    type="date"
                    value={form.issue_date}
                    onChange={(e) => setField("issue_date", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date d'échéance</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setField("due_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Projet lié</Label>
                  <Select
                    value={form.project_id || NO_VALUE}
                    onValueChange={(v) =>
                      setField("project_id", v === NO_VALUE ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>
                        <span className="text-muted-foreground">Aucun</span>
                      </SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Contact</Label>
                  <Select
                    value={form.contact_id || NO_VALUE}
                    onValueChange={(v) =>
                      setField("contact_id", v === NO_VALUE ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>
                        <span className="text-muted-foreground">Aucun</span>
                      </SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Entreprise</Label>
                  <Select
                    value={form.company_id || NO_VALUE}
                    onValueChange={(v) =>
                      setField("company_id", v === NO_VALUE ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_VALUE}>
                        <span className="text-muted-foreground">Aucune</span>
                      </SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Lignes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Lignes *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter une ligne
                  </Button>
                </div>
                <div className="border border-[var(--border)]">
                  <div className="grid grid-cols-[1fr_70px_90px_90px_28px] gap-0 border-b border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
                    <span className="text-[11px] text-muted-foreground">
                      Description
                    </span>
                    <span className="text-[11px] text-muted-foreground text-center">
                      Qté
                    </span>
                    <span className="text-[11px] text-muted-foreground text-center">
                      P.U. HT
                    </span>
                    <span className="text-[11px] text-muted-foreground text-right">
                      Total HT
                    </span>
                    <span />
                  </div>
                  {form.items.map((item, idx) => {
                    const lineTotal =
                      (parseFloat(item.quantity) || 0) *
                      (parseFloat(item.unit_price) || 0);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_70px_90px_90px_28px] gap-0 border-b border-[var(--border)] last:border-b-0"
                      >
                        <input
                          className="px-2.5 py-2 text-xs bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-[var(--muted)]/20 border-r border-[var(--border)]"
                          placeholder="Description…"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(idx, "description", e.target.value)
                          }
                        />
                        <input
                          className="px-2 py-2 text-xs bg-transparent text-foreground text-center placeholder:text-muted-foreground focus:outline-none focus:bg-[var(--muted)]/20 border-r border-[var(--border)]"
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(idx, "quantity", e.target.value)
                          }
                        />
                        <input
                          className="px-2 py-2 text-xs bg-transparent text-foreground text-center placeholder:text-muted-foreground focus:outline-none focus:bg-[var(--muted)]/20 border-r border-[var(--border)]"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(idx, "unit_price", e.target.value)
                          }
                        />
                        <span className="px-2 py-2 text-xs text-foreground text-right flex items-center justify-end border-r border-[var(--border)]">
                          {formatCurrency(lineTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          disabled={form.items.length === 1}
                          className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                          aria-label="Retirer la ligne"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Totaux */}
                <div className="mt-3 space-y-1 text-right">
                  <p className="text-xs text-muted-foreground">
                    Sous-total HT :{" "}
                    <span className="text-foreground font-medium font-mono">
                      {formatCurrency(totals.subtotal)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    TVA ({form.tax_rate}%) :{" "}
                    <span className="text-foreground font-medium font-mono">
                      {formatCurrency(totals.tax)}
                    </span>
                  </p>
                  <p className="text-sm font-bold text-foreground font-mono">
                    Total TTC : {formatCurrency(totals.total)}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={2}
                  placeholder="Conditions, mentions internes…"
                />
              </div>

              {error && (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-2.5 py-1.5 rounded-sm">
                  {error}
                </p>
              )}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit || pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DrawerFooter>
        </form>
    </ResponsiveDrawer>
  );
}
