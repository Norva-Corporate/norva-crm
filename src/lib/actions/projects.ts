"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/types";

// ============================================================
// Types
// ============================================================
export interface ProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  deal_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  assigned_to?: string | null;
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const PROJECT_SELECT =
  "*, deal:deals(id, title, value, contact:contacts(id, first_name, last_name), company:companies(id, name)), assignee:profiles(id, full_name)";

const VALID_STATUSES: ProjectStatus[] = [
  "en_attente",
  "en_cours",
  "en_pause",
  "termine",
  "annule",
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

function revalidateProjects(id?: string) {
  revalidatePath("/dashboard/projets");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/dashboard/projets/${id}`);
}

// ============================================================
// CREATE
// ============================================================
export async function createProject(
  data: ProjectInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  if (!data.name?.trim()) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  const status = data.status ?? "en_attente";
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: "Statut invalide." };
  }

  const payload = nullify({
    name: data.name.trim(),
    description: data.description,
    status,
    deal_id: data.deal_id,
    start_date: data.start_date,
    end_date: data.end_date,
    budget: data.budget ?? null,
    assigned_to: data.assigned_to,
  });

  const { data: inserted, error } = await supabase
    .from("projects")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }

  revalidateProjects();
  return { success: true, data: { id: inserted.id } };
}

// ============================================================
// UPDATE
// ============================================================
export async function updateProject(
  id: string,
  data: ProjectInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!data.name?.trim()) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return { success: false, error: "Statut invalide." };
  }

  const payload = nullify({
    name: data.name.trim(),
    description: data.description,
    status: data.status,
    deal_id: data.deal_id,
    start_date: data.start_date,
    end_date: data.end_date,
    budget: data.budget ?? null,
    assigned_to: data.assigned_to,
  });

  const { error } = await supabase.from("projects").update(payload).eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidateProjects(id);
  return { success: true, data: null };
}

// ============================================================
// UPDATE STATUS (raccourci)
// ============================================================
export async function updateProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: "Statut invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidateProjects(id);
  return { success: true, data: null };
}

// ============================================================
// DELETE
// ============================================================
export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidateProjects();
  return { success: true, data: null };
}

// ============================================================
// READ — fiche projet complète
// ============================================================
export async function getProjectWithDetails(id: string) {
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .single();

  if (error || !project) return null;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, type, status, total, due_date, issue_date, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  return { ...project, invoices: invoices ?? [] };
}
