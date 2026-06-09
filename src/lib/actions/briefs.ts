"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createProject } from "@/lib/actions/projects";
import { ensurePermission } from "@/lib/permissions/server";

type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface BriefContactRef {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface BriefCompanyRef {
  id: string;
  name: string;
}

export interface BriefListItem {
  id: string;
  prospect_nom: string | null;
  prospect_email: string | null;
  prospect_entreprise: string | null;
  submitted_at: string;
  contact: BriefContactRef | null;
  company: BriefCompanyRef | null;
}

export interface BriefDetail {
  id: string;
  token_id: string | null;
  prospect_nom: string | null;
  prospect_email: string | null;
  prospect_entreprise: string | null;
  reponses: Record<string, unknown>;
  submitted_at: string;
  contact: BriefContactRef | null;
  company: BriefCompanyRef | null;
}

export interface BriefTokenItem {
  id: string;
  token: string;
  prospect_nom: string;
  prospect_email: string;
  prospect_entreprise: string | null;
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
  contact: BriefContactRef | null;
  company: BriefCompanyRef | null;
}

const SELECT_BRIEF_LIST =
  "id, prospect_nom, prospect_email, prospect_entreprise, submitted_at, " +
  "contact:contacts(id, first_name, last_name, email), " +
  "company:companies(id, name)";

const SELECT_BRIEF_DETAIL =
  "id, token_id, prospect_nom, prospect_email, prospect_entreprise, reponses, submitted_at, " +
  "contact:contacts(id, first_name, last_name, email), " +
  "company:companies(id, name)";

const SELECT_TOKEN_LIST =
  "id, token, prospect_nom, prospect_email, prospect_entreprise, created_at, expires_at, used, used_at, " +
  "contact:contacts(id, first_name, last_name, email), " +
  "company:companies(id, name)";

export async function listBriefs(): Promise<BriefListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefs")
    .select(SELECT_BRIEF_LIST)
    .is("archived_at", null)
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[briefs] listBriefs error:", error);
    return [];
  }
  return (data ?? []) as unknown as BriefListItem[];
}

export async function getBriefById(id: string): Promise<BriefDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefs")
    .select(SELECT_BRIEF_DETAIL)
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    console.error("[briefs] getBriefById error:", error);
    return null;
  }
  if (!data) return null;
  const row = data as unknown as BriefDetail & { reponses: unknown };
  return {
    ...row,
    reponses: (row.reponses ?? {}) as Record<string, unknown>,
  };
}

export async function listActiveTokens(): Promise<BriefTokenItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brief_tokens")
    .select(SELECT_TOKEN_LIST)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[briefs] listActiveTokens error:", error);
    return [];
  }
  return (data ?? []) as unknown as BriefTokenItem[];
}

// ── Pickers helpers ─────────────────────────────────────────
// Listes minimales pour les Select de la modale "Générer un lien".
export interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_id: string | null;
}

export interface CompanyOption {
  id: string;
  name: string;
}

export async function listContactsForPicker(): Promise<ContactOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, company_id")
    .order("first_name", { ascending: true });

  if (error) {
    console.error("[briefs] listContactsForPicker:", error);
    return [];
  }
  return (data ?? []) as ContactOption[];
}

export async function listCompaniesForPicker(): Promise<CompanyOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    console.error("[briefs] listCompaniesForPicker:", error);
    return [];
  }
  return (data ?? []) as CompanyOption[];
}

// ── Archivage (soft delete) ─────────────────────────────────
// Les writes passent par service_role : pas de policy UPDATE générique
// exposée à l'anon key, l'app contrôle exactement ce qui peut bouger.

async function requireUser(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };
  return { ok: true, userId: user.id };
}

export async function archiveBriefToken(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("briefs.archive");
  if (denied) return { success: false, error: denied };

  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const service = createServiceClient();
  const { error } = await service
    .from("brief_tokens")
    .update({ archived_at: new Date().toISOString(), archived_by: auth.userId })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/briefs");
  return { success: true, data: null };
}

export async function archiveBrief(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("briefs.archive");
  if (denied) return { success: false, error: denied };

  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const service = createServiceClient();
  const { error } = await service
    .from("briefs")
    .update({ archived_at: new Date().toISOString(), archived_by: auth.userId })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/briefs");
  revalidatePath(`/dashboard/briefs/${id}`);
  return { success: true, data: null };
}

// ── Création d'un projet à partir d'un brief ────────────────
// Pré-remplit nom + contact_id + company_id à partir des données du brief.
// Le projet créé n'est pas (encore) lié en dur au brief — pas de FK
// `project_id` sur briefs ; ça pourra venir plus tard si besoin de
// remonter du projet vers son brief d'origine.
export async function createProjectFromBrief(
  briefId: string
): Promise<ActionResult<{ projectId: string }>> {
  const denied = await ensurePermission("briefs.convert_to_project");
  if (denied) return { success: false, error: denied };

  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const service = createServiceClient();
  const { data: brief, error: briefErr } = await service
    .from("briefs")
    .select(
      "id, prospect_nom, prospect_entreprise, contact_id, company_id, archived_at, company:companies(id, name)"
    )
    .eq("id", briefId)
    .maybeSingle();

  if (briefErr) return { success: false, error: briefErr.message };
  if (!brief || brief.archived_at) {
    return { success: false, error: "Brief introuvable" };
  }

  const companyName =
    (brief.company as { name?: string } | null)?.name ??
    brief.prospect_entreprise ??
    brief.prospect_nom ??
    "Brief";

  const projectName = `Projet ${companyName}`;
  const description = `Projet initié depuis le brief soumis par ${
    brief.prospect_nom ?? "le prospect"
  }.`;

  const result = await createProject({
    name: projectName,
    description,
    contact_id: brief.contact_id,
    company_id: brief.company_id,
    brief_id: brief.id,
    status: "en_attente",
  });

  if (!result.success) return result;

  revalidatePath(`/dashboard/briefs/${briefId}`);
  revalidatePath("/dashboard/projets");
  return { success: true, data: { projectId: result.data.id } };
}
