"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface LeadImport {
  id: string;
  source: string;
  external_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: string | null;
  company_name: string | null;
  company_domain: string | null;
  status: "pending" | "converted" | "dismissed" | "duplicate";
  contact_id: string | null;
  company_id: string | null;
  duplicate_of: string | null;
  raw_payload: Record<string, unknown> | null;
  imported_at: string;
  processed_at: string | null;
  processed_by: string | null;
  notes: string | null;
}

export interface LeadWithDedup extends LeadImport {
  existing_contact_id: string | null;
  existing_contact_name: string | null;
  existing_company_id: string | null;
  existing_company_name: string | null;
}

export async function listLeads(): Promise<LeadWithDedup[]> {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("lead_imports")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(200);
  if (!leads) return [];

  const emails = leads
    .map((l) => l.email?.toLowerCase())
    .filter((e): e is string => !!e);
  const domains = leads
    .map((l) => l.company_domain?.toLowerCase())
    .filter((d): d is string => !!d);

  const [{ data: matchingContacts }, { data: matchingCompanies }] =
    await Promise.all([
      emails.length > 0
        ? supabase
            .from("contacts")
            .select("id, first_name, last_name, email")
            .in("email", emails)
        : Promise.resolve({ data: [] as never[] }),
      domains.length > 0
        ? supabase
            .from("companies")
            .select("id, name, domain")
            .in("domain", domains)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const contactByEmail = new Map<
    string,
    { id: string; name: string }
  >();
  for (const c of matchingContacts ?? []) {
    if (c.email) {
      contactByEmail.set(c.email.toLowerCase(), {
        id: c.id,
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      });
    }
  }
  const companyByDomain = new Map<string, { id: string; name: string }>();
  for (const c of matchingCompanies ?? []) {
    if (c.domain) {
      companyByDomain.set(c.domain.toLowerCase(), { id: c.id, name: c.name });
    }
  }

  return leads.map((l) => {
    const matchContact = l.email
      ? contactByEmail.get(l.email.toLowerCase())
      : null;
    const matchCompany = l.company_domain
      ? companyByDomain.get(l.company_domain.toLowerCase())
      : null;
    return {
      ...l,
      existing_contact_id: matchContact?.id ?? null,
      existing_contact_name: matchContact?.name ?? null,
      existing_company_id: matchCompany?.id ?? null,
      existing_company_name: matchCompany?.name ?? null,
    } as LeadWithDedup;
  });
}

export async function convertLead(
  leadId: string,
  overrides?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    role?: string;
    company_id?: string | null;
    company_name?: string;
    company_domain?: string;
  }
): Promise<ActionResult<{ contact_id: string; company_id: string | null }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: lead } = await supabase
    .from("lead_imports")
    .select("*")
    .eq("id", leadId)
    .single();
  if (!lead) return { success: false, error: "Lead introuvable." };
  if (lead.status === "converted") {
    return { success: false, error: "Lead déjà converti." };
  }

  const first_name = (overrides?.first_name ?? lead.first_name ?? "").trim();
  const last_name = (overrides?.last_name ?? lead.last_name ?? "").trim();
  if (!first_name || !last_name) {
    return {
      success: false,
      error: "Prénom et nom requis pour créer le contact.",
    };
  }
  const email = (overrides?.email ?? lead.email ?? "").trim() || null;
  const phone = (overrides?.phone ?? lead.phone ?? "").trim() || null;
  const role = (overrides?.role ?? lead.role ?? "").trim() || null;

  // Resolve company
  let companyId: string | null = overrides?.company_id ?? null;
  if (companyId === undefined) companyId = null;

  if (!companyId && (overrides?.company_name || lead.company_name)) {
    const name = (
      overrides?.company_name ??
      lead.company_name ??
      ""
    ).trim();
    const domain = (
      overrides?.company_domain ??
      lead.company_domain ??
      ""
    )
      .trim()
      .toLowerCase() || null;

    // Try match by domain first
    if (domain) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("domain", domain)
        .maybeSingle();
      if (existing) companyId = existing.id;
    }
    if (!companyId && name) {
      const { data: created, error: cErr } = await supabase
        .from("companies")
        .insert({ name, domain, created_by: user.id })
        .select("id")
        .single();
      if (cErr || !created) {
        return {
          success: false,
          error: cErr?.message ?? "Impossible de créer l'entreprise.",
        };
      }
      companyId = created.id;
    }
  }

  // Create contact
  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .insert({
      first_name,
      last_name,
      email,
      phone,
      role,
      company_id: companyId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (cErr || !contact) {
    return {
      success: false,
      error: cErr?.message ?? "Impossible de créer le contact.",
    };
  }

  await supabase
    .from("lead_imports")
    .update({
      status: "converted",
      contact_id: contact.id,
      company_id: companyId,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq("id", leadId);

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/contacts");
  if (companyId) revalidatePath("/dashboard/companies");

  return {
    success: true,
    data: { contact_id: contact.id, company_id: companyId },
  };
}

export async function markLeadAsDuplicate(
  leadId: string,
  contactId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { error } = await supabase
    .from("lead_imports")
    .update({
      status: "duplicate",
      duplicate_of: contactId,
      contact_id: contactId,
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq("id", leadId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/leads");
  return { success: true, data: null };
}

export async function dismissLead(leadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { error } = await supabase
    .from("lead_imports")
    .update({
      status: "dismissed",
      processed_at: new Date().toISOString(),
      processed_by: user.id,
    })
    .eq("id", leadId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/leads");
  return { success: true, data: null };
}

export async function reopenLead(leadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_imports")
    .update({
      status: "pending",
      processed_at: null,
      processed_by: null,
    })
    .eq("id", leadId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/leads");
  return { success: true, data: null };
}
