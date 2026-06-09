"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/permissions/server";
import { syncEntityToAllConnectedUsers } from "@/lib/integrations/google-calendar";
import type { ProjectStatus } from "@/types";

// ============================================================
// Types
// ============================================================
export interface ProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  deal_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  duration_days?: number;
  assigned_to?: string | null;
  brief_id?: string | null;
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const PROJECT_SELECT =
  "*, deal:deals(id, title, value, contact:contacts(id, first_name, last_name), company:companies(id, name)), contact:contacts!projects_contact_id_fkey(id, first_name, last_name), company:companies!projects_company_id_fkey(id, name), assignee:profiles!projects_assigned_to_fkey(id, full_name), brief:briefs(id, prospect_nom, submitted_at)";

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

/** Clamp durée projet : 1-180 jours, default 14. */
function clampDuration(d: number | undefined): number {
  if (d == null || !Number.isFinite(d)) return 14;
  return Math.min(180, Math.max(1, Math.round(d)));
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
  const denied = await ensurePermission("projects.create");
  if (denied) return { success: false, error: denied };

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
    contact_id: data.contact_id,
    company_id: data.company_id,
    start_date: data.start_date,
    end_date: data.end_date,
    budget: data.budget ?? null,
    assigned_to: data.assigned_to,
    brief_id: data.brief_id,
  });

  const duration = clampDuration(data.duration_days);
  const { data: inserted, error } = await supabase
    .from("projects")
    .insert({ ...payload, created_by: user.id, duration_days: duration })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }

  void syncEntityToAllConnectedUsers("project", inserted.id).catch((e) =>
    console.error("[gcal sync] createProject:", e)
  );
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
  const denied = await ensurePermission("projects.update");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();

  if (!data.name?.trim()) {
    return { success: false, error: "Le nom est obligatoire." };
  }

  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return { success: false, error: "Statut invalide." };
  }

  const payload: Record<string, unknown> = nullify({
    name: data.name.trim(),
    description: data.description,
    status: data.status,
    deal_id: data.deal_id,
    contact_id: data.contact_id,
    company_id: data.company_id,
    start_date: data.start_date,
    end_date: data.end_date,
    budget: data.budget ?? null,
    assigned_to: data.assigned_to,
  });
  if (data.duration_days !== undefined) {
    payload.duration_days = clampDuration(data.duration_days);
  }

  const { error } = await supabase.from("projects").update(payload).eq("id", id);

  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("project", id).catch((e) =>
    console.error("[gcal sync] updateProject:", e)
  );
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
  const denied = await ensurePermission("projects.update_status");
  if (denied) return { success: false, error: denied };

  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: "Statut invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("project", id).catch((e) =>
    console.error("[gcal sync] updateProjectStatus:", e)
  );
  revalidateProjects(id);
  return { success: true, data: null };
}

// ============================================================
// DELETE
// ============================================================
export async function deleteProject(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("projects.delete");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("project", id).catch((e) =>
    console.error("[gcal sync] deleteProject:", e)
  );
  revalidateProjects();
  return { success: true, data: null };
}

// ============================================================
// GOOGLE DRIVE (Phase C, 039) — auto-création de dossier
// ============================================================
/**
 * Idempotent : crée un dossier Drive lié à ce projet si aucun
 * n'existe, sinon renvoie l'URL en cache. Utilise le scope
 * `drive.file` du provider google_calendar (cf. connect/route.ts).
 */
export async function ensureProjectDriveFolder(
  projectId: string
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: project, error: readErr } = await supabase
    .from("projects")
    .select("id, name, drive_folder_id, drive_folder_url")
    .eq("id", projectId)
    .maybeSingle();
  if (readErr || !project) {
    return {
      success: false,
      error: readErr?.message ?? "Projet introuvable.",
    };
  }

  if (project.drive_folder_url && project.drive_folder_id) {
    return { success: true, data: { url: project.drive_folder_url } };
  }

  let folder;
  try {
    const { createProjectDriveFolder } = await import(
      "@/lib/integrations/google-drive"
    );
    folder = await createProjectDriveFolder(user.id, project.name);
  } catch (err) {
    const msg = (err as Error).message ?? "Création Drive impossible.";
    console.error("[drive] ensureProjectDriveFolder:", err);
    return {
      success: false,
      error: msg.includes("no google_calendar integration")
        ? "Connectez Google Drive dans Intégrations d'abord."
        : msg.includes("invalid_grant")
        ? "Reconnectez votre compte Google (re-auth nécessaire)."
        : "Création du dossier Drive impossible.",
    };
  }

  const { error: updErr } = await supabase
    .from("projects")
    .update({
      drive_folder_id: folder.id,
      drive_folder_url: folder.webViewLink,
    })
    .eq("id", projectId);
  if (updErr) {
    console.error("[drive] cache write failed:", updErr);
    return { success: true, data: { url: folder.webViewLink } };
  }

  revalidateProjects(projectId);
  return { success: true, data: { url: folder.webViewLink } };
}

// ============================================================
// PATCH — partial update for inline editing
// ============================================================
export type ProjectPatch = Partial<{
  name: string;
  description: string | null;
  status: ProjectStatus;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  duration_days: number;
  assigned_to: string | null;
}>;

export async function patchProject(
  id: string,
  patch: ProjectPatch
): Promise<ActionResult> {
  const denied = await ensurePermission("projects.update");
  if (denied) return { success: false, error: denied };

  if (
    "name" in patch &&
    (typeof patch.name !== "string" || !patch.name.trim())
  ) {
    return { success: false, error: "Le nom est obligatoire." };
  }
  if (patch.status && !VALID_STATUSES.includes(patch.status)) {
    return { success: false, error: "Statut invalide." };
  }

  const payload: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof ProjectPatch)[]) {
    const v = patch[k];
    if (k === "name") {
      payload[k] = (v as string).trim();
    } else if (k === "duration_days") {
      payload[k] = clampDuration(v as number);
    } else {
      payload[k] = v === "" ? null : v;
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(payload).eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("project", id).catch((e) =>
    console.error("[gcal sync] patchProject:", e)
  );
  revalidateProjects(id);
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

// ============================================================
// LIST — Phase D3
// ============================================================
export async function listProjectsWithRelations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "*, deal:deals(id, title, contact:contacts(id, first_name, last_name), company:companies(id, name)), contact:contacts!projects_contact_id_fkey(id, first_name, last_name), company:companies!projects_company_id_fkey(id, name), assignee:profiles!projects_assigned_to_fkey(id, full_name)"
    )
    .order("created_at", { ascending: false });
  return data ?? [];
}
