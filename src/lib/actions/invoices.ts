"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncEntityToAllConnectedUsers } from "@/lib/integrations/google-calendar";
import type { DocumentType, InvoiceStatus } from "@/types";

// ============================================================
// Types
// ============================================================
export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface InvoiceInput {
  type?: DocumentType;
  status?: InvoiceStatus;
  number?: string | null;
  project_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  issue_date: string;
  due_date?: string | null;
  tax_rate: number;
  notes?: string | null;
  items: InvoiceItemInput[];
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const INVOICE_SELECT =
  "*, project:projects(id, name), contact:contacts(id, first_name, last_name), company:companies(id, name)";

const VALID_STATUSES: InvoiceStatus[] = [
  "brouillon",
  "envoyee",
  "payee",
  "en_retard",
  "annulee",
];

// ============================================================
// Helpers
// ============================================================
function nullify<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k in obj) {
    const v = obj[k];
    out[k] = (v === "" || v === undefined ? null : v) as T[Extract<keyof T, string>];
  }
  return out;
}

function revalidateInvoices(id?: string) {
  revalidatePath("/dashboard/facturation");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/dashboard/facturation/${id}`);
}

function computeTotals(items: InvoiceItemInput[], taxRate: number) {
  const subtotal = items.reduce(
    (sum, it) =>
      sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const tax_amount = subtotal * (taxRate / 100);
  const total = subtotal + tax_amount;
  return { subtotal, tax_amount, total };
}

// ============================================================
// CREATE
// ============================================================
export async function createInvoice(
  data: InvoiceInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const type: DocumentType = data.type ?? "invoice";
  const status: InvoiceStatus = data.status ?? "brouillon";

  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: "Statut invalide." };
  }

  if (!data.issue_date) {
    return { success: false, error: "La date d'émission est obligatoire." };
  }

  let number = data.number?.trim() ?? "";
  if (!number) {
    const { data: generated, error: rpcErr } = await supabase.rpc(
      "generate_invoice_number",
      { doc_type: type }
    );
    if (rpcErr || !generated) {
      return {
        success: false,
        error: rpcErr?.message ?? "Impossible de générer le numéro.",
      };
    }
    number = generated as string;
  }

  const taxRate = Number.isFinite(data.tax_rate) ? data.tax_rate : 20;
  const { subtotal, tax_amount, total } = computeTotals(data.items, taxRate);

  const payload = nullify({
    number,
    type,
    status,
    project_id: data.project_id,
    contact_id: data.contact_id,
    company_id: data.company_id,
    issue_date: data.issue_date,
    due_date: data.due_date,
    subtotal,
    tax_rate: taxRate,
    tax_amount,
    total,
    notes: data.notes,
  });

  const { data: inserted, error } = await supabase
    .from("invoices")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }

  if (data.items.length > 0) {
    const itemsPayload = data.items.map((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unit_price) || 0;
      return {
        invoice_id: inserted.id,
        description: it.description,
        quantity: qty,
        unit_price: unit,
        total: qty * unit,
        sort_order: idx,
      };
    });
    const { error: itemsErr } = await supabase
      .from("invoice_items")
      .insert(itemsPayload);
    if (itemsErr) {
      return { success: false, error: itemsErr.message };
    }
  }

  void syncEntityToAllConnectedUsers("invoice", inserted.id).catch((e) =>
    console.error("[gcal sync] createInvoice:", e)
  );
  revalidateInvoices();
  return { success: true, data: { id: inserted.id } };
}

// ============================================================
// UPDATE
// ============================================================
export async function updateInvoice(
  id: string,
  data: InvoiceInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return { success: false, error: "Statut invalide." };
  }

  if (!data.issue_date) {
    return { success: false, error: "La date d'émission est obligatoire." };
  }

  const taxRate = Number.isFinite(data.tax_rate) ? data.tax_rate : 20;
  const { subtotal, tax_amount, total } = computeTotals(data.items, taxRate);

  const payload = nullify({
    number: data.number?.trim() || undefined,
    type: data.type,
    status: data.status,
    project_id: data.project_id,
    contact_id: data.contact_id,
    company_id: data.company_id,
    issue_date: data.issue_date,
    due_date: data.due_date,
    subtotal,
    tax_rate: taxRate,
    tax_amount,
    total,
    notes: data.notes,
  });

  const { error } = await supabase.from("invoices").update(payload).eq("id", id);
  if (error) return { success: false, error: error.message };

  // Replace items
  const { error: delErr } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);
  if (delErr) return { success: false, error: delErr.message };

  if (data.items.length > 0) {
    const itemsPayload = data.items.map((it, idx) => {
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unit_price) || 0;
      return {
        invoice_id: id,
        description: it.description,
        quantity: qty,
        unit_price: unit,
        total: qty * unit,
        sort_order: idx,
      };
    });
    const { error: itemsErr } = await supabase
      .from("invoice_items")
      .insert(itemsPayload);
    if (itemsErr) return { success: false, error: itemsErr.message };
  }

  void syncEntityToAllConnectedUsers("invoice", id).catch((e) =>
    console.error("[gcal sync] updateInvoice:", e)
  );
  revalidateInvoices(id);
  return { success: true, data: null };
}

// ============================================================
// UPDATE STATUS (raccourcis depuis l'aperçu)
// ============================================================
export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: "Statut invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("invoice", id).catch((e) =>
    console.error("[gcal sync] updateInvoiceStatus:", e)
  );
  revalidateInvoices(id);
  return { success: true, data: null };
}

// ============================================================
// DELETE
// ============================================================
export async function deleteInvoice(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("invoice", id).catch((e) =>
    console.error("[gcal sync] deleteInvoice:", e)
  );
  revalidateInvoices();
  return { success: true, data: null };
}

// ============================================================
// CONVERT — devis -> facture (1.1)
// ============================================================
// Crée une nouvelle facture en clonant les line items du devis.
// Numéro régénéré via RPC, statut "brouillon",
// date d'émission = aujourd'hui, échéance = +30 jours.
export async function convertQuoteToInvoice(
  quoteId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: quote, error: qErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", quoteId)
    .single();
  if (qErr || !quote) {
    return { success: false, error: "Devis introuvable." };
  }
  if (quote.type !== "quote") {
    return {
      success: false,
      error: "Seuls les devis peuvent être convertis en facture.",
    };
  }

  const { data: number, error: rpcErr } = await supabase.rpc(
    "generate_invoice_number",
    { doc_type: "invoice" }
  );
  if (rpcErr || !number) {
    return {
      success: false,
      error: rpcErr?.message ?? "Impossible de générer le numéro de facture.",
    };
  }

  const today = new Date();
  const issue_date = today.toISOString().split("T")[0];
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  const due_date = due.toISOString().split("T")[0];

  const { data: inserted, error: insErr } = await supabase
    .from("invoices")
    .insert({
      number,
      type: "invoice",
      status: "brouillon",
      project_id: quote.project_id,
      contact_id: quote.contact_id,
      company_id: quote.company_id,
      issue_date,
      due_date,
      subtotal: quote.subtotal,
      tax_rate: quote.tax_rate,
      tax_amount: quote.tax_amount,
      total: quote.total,
      notes: quote.notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return {
      success: false,
      error: insErr?.message ?? "Création de la facture impossible.",
    };
  }

  const { data: items } = await supabase
    .from("invoice_items")
    .select("description, quantity, unit_price, total, sort_order")
    .eq("invoice_id", quoteId)
    .order("sort_order", { ascending: true });

  if (items && items.length > 0) {
    const payload = items.map((it, idx) => ({
      invoice_id: inserted.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: it.total,
      sort_order: idx,
    }));
    const { error: itemsErr } = await supabase
      .from("invoice_items")
      .insert(payload);
    if (itemsErr) {
      return { success: false, error: itemsErr.message };
    }
  }

  void syncEntityToAllConnectedUsers("invoice", inserted.id).catch((e) =>
    console.error("[gcal sync] convertQuoteToInvoice:", e)
  );
  revalidateInvoices(inserted.id);
  return { success: true, data: { id: inserted.id } };
}

// ============================================================
// READ — dernier numéro pour preview
// ============================================================
export async function getLastInvoiceNumber(
  type: DocumentType
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("number")
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.number ?? null;
}

// ============================================================
// READ — fiche facture complète
// ============================================================
export async function getInvoiceWithDetails(id: string) {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", id)
    .single();

  if (error || !invoice) return null;

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order", { ascending: true });

  return { ...invoice, items: items ?? [] };
}

// ============================================================
// LIST — Phase D3
// ============================================================
export async function listInvoicesWithRelations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "*, project:projects(id, name), contact:contacts(id, first_name, last_name), company:companies(id, name)"
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}
