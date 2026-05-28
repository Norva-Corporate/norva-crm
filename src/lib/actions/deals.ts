"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncEntityToAllConnectedUsers } from "@/lib/integrations/google-calendar";
import type { DealStage, DealWithRelations } from "@/types";

// ============================================================
// Types
// ============================================================
export interface DealInput {
  title: string;
  value?: number | null;
  stage?: DealStage;
  probability?: number | null;
  expected_close_date?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const DEAL_SELECT =
  "*, contact:contacts(id, first_name, last_name), company:companies(id, name), assignee:profiles!deals_assigned_to_fkey(id, full_name, email, avatar_url, role, created_at, updated_at), source_lead:lead_imports!deals_source_lead_id_fkey(id, first_name, last_name, company_name)";

const VALID_STAGES: DealStage[] = [
  "discussion",
  "proposal",
  "negotiation",
  "won",
  "lost",
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

function revalidateDeals() {
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard");
}

// ============================================================
// READ
// ============================================================
export async function getDealsWithRelations(): Promise<DealWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_SELECT)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as unknown as DealWithRelations[];
}

// ============================================================
// CREATE
// ============================================================
export async function createDeal(
  data: DealInput
): Promise<ActionResult<DealWithRelations>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  if (!data.title?.trim()) {
    return { success: false, error: "Le titre est obligatoire." };
  }

  const stage = data.stage ?? "discussion";
  if (!VALID_STAGES.includes(stage)) {
    return { success: false, error: "Étape invalide." };
  }

  const payload = nullify({
    title: data.title.trim(),
    value: data.value ?? null,
    stage,
    probability: data.probability ?? null,
    expected_close_date: data.expected_close_date,
    contact_id: data.contact_id,
    company_id: data.company_id,
    assigned_to: data.assigned_to,
    notes: data.notes,
  });

  const { data: inserted, error } = await supabase
    .from("deals")
    .insert({ ...payload, created_by: user.id })
    .select(DEAL_SELECT)
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }

  void syncEntityToAllConnectedUsers("deal", inserted.id).catch((e) =>
    console.error("[gcal sync] createDeal:", e)
  );
  revalidateDeals();
  return { success: true, data: inserted as unknown as DealWithRelations };
}

// ============================================================
// UPDATE
// ============================================================
export async function updateDeal(
  id: string,
  data: DealInput
): Promise<ActionResult<DealWithRelations>> {
  const supabase = await createClient();

  if (!data.title?.trim()) {
    return { success: false, error: "Le titre est obligatoire." };
  }

  if (data.stage && !VALID_STAGES.includes(data.stage)) {
    return { success: false, error: "Étape invalide." };
  }

  const payload = nullify({
    title: data.title.trim(),
    value: data.value ?? null,
    stage: data.stage,
    probability: data.probability ?? null,
    expected_close_date: data.expected_close_date,
    contact_id: data.contact_id,
    company_id: data.company_id,
    assigned_to: data.assigned_to,
    notes: data.notes,
  });

  const { data: updated, error } = await supabase
    .from("deals")
    .update(payload)
    .eq("id", id)
    .select(DEAL_SELECT)
    .single();

  if (error || !updated) {
    return { success: false, error: error?.message ?? "Mise à jour impossible." };
  }

  void syncEntityToAllConnectedUsers("deal", id).catch((e) =>
    console.error("[gcal sync] updateDeal:", e)
  );
  revalidateDeals();
  return { success: true, data: updated as unknown as DealWithRelations };
}

// ============================================================
// UPDATE STAGE (drag & drop)
// ============================================================
export async function updateDealStage(
  id: string,
  stage: DealStage
): Promise<ActionResult> {
  if (!VALID_STAGES.includes(stage)) {
    return { success: false, error: "Étape invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ stage })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("deal", id).catch((e) =>
    console.error("[gcal sync] updateDealStage:", e)
  );
  revalidateDeals();
  return { success: true, data: null };
}

// ============================================================
// MARK WON / LOST (raccourcis depuis le drawer)
// ============================================================
export async function markDealWon(id: string): Promise<ActionResult> {
  return updateDealStage(id, "won");
}

export async function markDealLost(id: string): Promise<ActionResult> {
  return updateDealStage(id, "lost");
}

// ============================================================
// DELETE
// ============================================================
export async function deleteDeal(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("deal", id).catch((e) =>
    console.error("[gcal sync] deleteDeal:", e)
  );
  revalidateDeals();
  return { success: true, data: null };
}
