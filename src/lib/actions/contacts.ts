"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ============================================================
// Types des payloads
// ============================================================
export interface ContactInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  company_id?: string | null;
  notes?: string | null;
}

export interface CompanyInput {
  name: string;
  sector?: string | null;
  domain?: string | null;
  size?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

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

function revalidateContacts() {
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/companies");
}

// ============================================================
// CONTACTS
// ============================================================
export async function createContact(
  data: ContactInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  if (!data.first_name?.trim() || !data.last_name?.trim()) {
    return { success: false, error: "Prénom et nom obligatoires." };
  }

  const payload = nullify({
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: data.email,
    phone: data.phone,
    role: data.role,
    company_id: data.company_id,
    notes: data.notes,
  });

  const { data: inserted, error } = await supabase
    .from("contacts")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateContacts();
  return { success: true, data: { id: inserted.id } };
}

export async function updateContact(
  id: string,
  data: ContactInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!data.first_name?.trim() || !data.last_name?.trim()) {
    return { success: false, error: "Prénom et nom obligatoires." };
  }

  const payload = nullify({
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: data.email,
    phone: data.phone,
    role: data.role,
    company_id: data.company_id,
    notes: data.notes,
  });

  const { error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidateContacts();
  revalidatePath(`/dashboard/contacts/${id}`);
  return { success: true, data: null };
}

export async function deleteContact(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidateContacts();
  return { success: true, data: null };
}

export type ContactPatch = Partial<{
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  company_id: string | null;
  notes: string | null;
}>;

export async function patchContact(
  id: string,
  patch: ContactPatch
): Promise<ActionResult> {
  if (
    "first_name" in patch &&
    (typeof patch.first_name !== "string" || !patch.first_name.trim())
  ) {
    return { success: false, error: "Le prénom est obligatoire." };
  }
  if (
    "last_name" in patch &&
    (typeof patch.last_name !== "string" || !patch.last_name.trim())
  ) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  const payload: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof ContactPatch)[]) {
    const v = patch[k];
    if (k === "first_name" || k === "last_name") {
      payload[k] = (v as string).trim();
    } else {
      payload[k] = v === "" ? null : v;
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update(payload).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidateContacts();
  revalidatePath(`/dashboard/contacts/${id}`);
  return { success: true, data: null };
}

export async function getContactWithDeals(id: string) {
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*, company:companies(*)")
    .eq("id", id)
    .single();

  if (error || !contact) return null;

  const { data: deals } = await supabase
    .from("deals")
    .select("*, contact:contacts(id, first_name, last_name), company:companies(id, name), assignee:profiles!deals_assigned_to_fkey(*)")
    .eq("contact_id", id)
    .order("created_at", { ascending: false });

  return { ...contact, deals: deals ?? [] };
}

// ============================================================
// COMPANIES
// ============================================================
export async function createCompany(
  data: CompanyInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  if (!data.name?.trim()) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  const payload = nullify({
    name: data.name.trim(),
    sector: data.sector,
    domain: data.domain,
    size: data.size,
    website: data.website,
    phone: data.phone,
    address: data.address,
    notes: data.notes,
  });

  const { data: inserted, error } = await supabase
    .from("companies")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateContacts();
  return { success: true, data: { id: inserted.id } };
}

export async function updateCompany(
  id: string,
  data: CompanyInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!data.name?.trim()) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  const payload = nullify({
    name: data.name.trim(),
    sector: data.sector,
    domain: data.domain,
    size: data.size,
    website: data.website,
    phone: data.phone,
    address: data.address,
    notes: data.notes,
  });

  const { error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidateContacts();
  revalidatePath(`/dashboard/companies/${id}`);
  return { success: true, data: null };
}

export async function deleteCompany(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidateContacts();
  return { success: true, data: null };
}

export type CompanyPatch = Partial<{
  name: string;
  sector: string | null;
  domain: string | null;
  size: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}>;

export async function patchCompany(
  id: string,
  patch: CompanyPatch
): Promise<ActionResult> {
  if (
    "name" in patch &&
    (typeof patch.name !== "string" || !patch.name.trim())
  ) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  const payload: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof CompanyPatch)[]) {
    const v = patch[k];
    if (k === "name") {
      payload[k] = (v as string).trim();
    } else {
      payload[k] = v === "" ? null : v;
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("companies").update(payload).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidateContacts();
  revalidatePath(`/dashboard/companies/${id}`);
  return { success: true, data: null };
}

export async function getCompanyWithContactsAndDeals(id: string) {
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !company) return null;

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("company_id", id)
    .order("last_name", { ascending: true });

  const { data: deals } = await supabase
    .from("deals")
    .select("*, contact:contacts(id, first_name, last_name), company:companies(id, name), assignee:profiles!deals_assigned_to_fkey(*)")
    .eq("company_id", id)
    .order("created_at", { ascending: false });

  return {
    ...company,
    contacts: contacts ?? [],
    deals: deals ?? [],
  };
}

// ============================================================
// LIST helpers — Phase D3 (uniformisation data-fetching)
// ============================================================
export async function listContactsWithCompany() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface CompanyWithCount {
  id: string;
  name: string;
  domain: string | null;
  sector: string | null;
  size: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  contacts_count: number;
}

export async function listCompaniesWithContactCount(): Promise<
  CompanyWithCount[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("*, contacts(count)")
    .order("name");

  type Row = Omit<CompanyWithCount, "contacts_count"> & {
    contacts: { count: number }[] | null;
  };
  return ((data ?? []) as Row[]).map((c) => {
    const { contacts, ...rest } = c;
    return { ...rest, contacts_count: contacts?.[0]?.count ?? 0 };
  });
}
