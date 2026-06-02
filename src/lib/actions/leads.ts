"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getActivitiesForEntity,
} from "@/lib/actions/activities";
import { getTagsForEntity } from "@/lib/actions/tags";
import { syncEntityToAllConnectedUsers } from "@/lib/integrations/google-calendar";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export type LeadStatus =
  | "pending"
  | "qualified"
  | "converted"
  | "dismissed"
  | "duplicate";

export type LeadTemperature = "cold" | "warm" | "hot";

// ============================================================
// Pipeline kanban (017)
// ============================================================
export type LeadPipelineStage =
  | "brut"
  | "verified"
  | "to_contact"
  | "to_email"
  | "contacted"
  | "in_discussion"
  | "stand_by";

export type LeadEmailVerified = "valid" | "risky" | "invalid" | "unverified";

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
  status: LeadStatus;
  contact_id: string | null;
  company_id: string | null;
  duplicate_of: string | null;
  raw_payload: Record<string, unknown> | null;
  imported_at: string;
  processed_at: string | null;
  processed_by: string | null;
  notes: string | null;
  // Qualification (016)
  assigned_to: string | null;
  temperature: LeadTemperature | null;
  qualification_score: number | null;
  next_follow_up_at: string | null;
  estimated_budget: number | null;
  expected_close_date: string | null;
  // Verification + kanban (017)
  email_verified: LeadEmailVerified;
  linkedin_verified: boolean;
  company_active: boolean | null;
  pagespeed_score: number | null;
  quality_score: number | null;
  pipeline_stage: LeadPipelineStage;
  verified_at: string | null;
  // Stage tracking (020)
  stage_updated_at: string;
}

export interface LeadAssignee {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface LeadWithDedup extends LeadImport {
  existing_contact_id: string | null;
  existing_contact_name: string | null;
  existing_company_id: string | null;
  existing_company_name: string | null;
  assignee: LeadAssignee | null;
}

export async function listLeads(): Promise<LeadWithDedup[]> {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("lead_imports")
    .select(
      "*, assignee:profiles!lead_imports_assigned_to_fkey(id, email, full_name, avatar_url)"
    )
    // Filtre serveur : seuls les leads "actifs" (pending / qualified) sont
    // pertinents pour le kanban. Les converted/dismissed/duplicate sont
    // terminaux — les charger gonflait inutilement le DOM (jusqu'à 158 leads
    // dismissed sur 499 total) ET autorisait des drags impossibles côté
    // serveur (rejet avec error, rollback côté client → faux sentiment de
    // latence).
    .in("status", ["pending", "qualified"])
    // Tri par `stage_updated_at` DESC : les leads activement travaillés
    // remontent en premier (un lead bougé dans le kanban aujourd'hui passe
    // devant un lead importé plus tard mais jamais touché). Fallback sur
    // `imported_at` pour les leads dont le stage n'a jamais bougé.
    .order("stage_updated_at", { ascending: false, nullsFirst: false })
    .order("imported_at", { ascending: false });
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
    // Supabase typing: nested fk-resolved relation may come back as object or array
    const rawAssignee = (l as { assignee?: unknown }).assignee;
    const assignee = (
      Array.isArray(rawAssignee) ? rawAssignee[0] : rawAssignee
    ) as LeadAssignee | null | undefined;
    return {
      ...l,
      existing_contact_id: matchContact?.id ?? null,
      existing_contact_name: matchContact?.name ?? null,
      existing_company_id: matchCompany?.id ?? null,
      existing_company_name: matchCompany?.name ?? null,
      assignee: assignee ?? null,
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

  revalidatePath("/dashboard/pipeline");
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

  revalidatePath("/dashboard/pipeline");
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

  revalidatePath("/dashboard/pipeline");
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
  revalidatePath("/dashboard/pipeline");
  return { success: true, data: null };
}

// ============================================================
// Qualification (016)
// ============================================================

export interface LeadUpdatePatch {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  company_name?: string | null;
  company_domain?: string | null;
  notes?: string | null;
  assigned_to?: string | null;
  temperature?: LeadTemperature | null;
  qualification_score?: number | null;
  next_follow_up_at?: string | null;
  estimated_budget?: number | null;
  expected_close_date?: string | null;
}

const ALLOWED_UPDATE_KEYS: (keyof LeadUpdatePatch)[] = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "role",
  "company_name",
  "company_domain",
  "notes",
  "assigned_to",
  "temperature",
  "qualification_score",
  "next_follow_up_at",
  "estimated_budget",
  "expected_close_date",
];

/**
 * Update arbitrary fields on a lead. Used by the LeadDrawer for inline edits.
 * Only whitelisted keys are applied — unknown keys are silently dropped.
 */
export async function updateLead(
  leadId: string,
  patch: LeadUpdatePatch
): Promise<ActionResult<LeadImport>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const cleaned: Record<string, unknown> = {};
  for (const k of ALLOWED_UPDATE_KEYS) {
    if (k in patch) {
      const v = patch[k];
      // Normalize empty strings to null so we don't store ''
      cleaned[k] = typeof v === "string" && v.trim() === "" ? null : v;
    }
  }
  if (Object.keys(cleaned).length === 0) {
    // Nothing to update — read current value to keep the contract.
    const { data } = await supabase
      .from("lead_imports")
      .select("*")
      .eq("id", leadId)
      .single();
    return data
      ? { success: true, data: data as LeadImport }
      : { success: false, error: "Lead introuvable." };
  }

  const { data, error } = await supabase
    .from("lead_imports")
    .update(cleaned)
    .eq("id", leadId)
    .select("*")
    .single();
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Mise à jour impossible.",
    };
  }

  // Si la date de relance a été modifiée, recréer / annuler la tâche
  // auto + sync GCal. On le fait en `after()` pour que la server action
  // rende la main au client dès que le lead est sauvé (le drawer peut
  // ainsi refléter la nouvelle valeur instantanément, sans attendre
  // les 3 DB roundtrips + sync GCal qui prennent ~500ms-1s).
  if ("next_follow_up_at" in cleaned) {
    const fullLead = data as LeadImport & {
      pipeline_stage: LeadPipelineStage;
    };
    const uid = user.id;
    after(async () => {
      const sb = await createClient();
      await ensureLeadFollowUpTask(sb, fullLead, uid);
      revalidatePath("/dashboard/taches");
    });
  }

  revalidatePath("/dashboard/pipeline");
  return { success: true, data: data as LeadImport };
}

// ============================================================
// Pipeline stage (017) — drag & drop kanban
// ============================================================

const VALID_PIPELINE_STAGES: LeadPipelineStage[] = [
  "brut",
  "verified",
  "to_contact",
  "to_email",
  "contacted",
  "in_discussion",
  "stand_by",
];

/**
 * Mapping entre les colonnes du kanban et le `status` legacy.
 * - Brut + Vérifié = `pending` (lead pas encore qualifié)
 * - À contacter + Contacté + En discussion = `qualified` (lead jugé bon)
 *
 * Synchroniser les deux axes permet à la vue liste (filtre par status)
 * et à la vue kanban (filtre par stage) de rester cohérentes.
 */
function stageToStatus(stage: LeadPipelineStage): "pending" | "qualified" {
  return stage === "brut" || stage === "verified" ? "pending" : "qualified";
}

// ============================================================
// Tâches auto liées au stage (020)
// ============================================================
//
// Quand un lead change de stage, on crée une tâche de relance auto
// UNIQUEMENT si :
//   - le stage est `contacted` ou `stand_by` (vraies relances ; `to_contact` /
//     `to_email` / `in_discussion` = premier contact ou prépa deal, hors scope),
//   - ET le lead a une date de relance posée dans `next_follow_up_at`.
// La due_date de la tâche est exactement `next_follow_up_at` (champ rempli
// manuellement depuis le LeadDrawer). Aucune date posée → aucune tâche créée.
// La dédup via `tasks.auto_origin` reste active.

type StageTaskTemplate = {
  title: (fullName: string) => string;
  description: string;
  priority: "normal" | "high" | "urgent";
};

const STAGE_TASK_TEMPLATES: Partial<
  Record<LeadPipelineStage, StageTaskTemplate>
> = {
  contacted: {
    title: (name) => `Relancer ${name}`,
    description: "Vérifier la réponse au cold outreach.",
    priority: "normal",
  },
  stand_by: {
    title: (name) => `Recontacter ${name}`,
    description: "Lead parké — relance prévue.",
    priority: "normal",
  },
};

/**
 * Crée / met à jour la tâche de relance liée à un lead, avec dédup
 * propre via `tasks.auto_origin`. Triggers :
 *   1. Changement de stage du lead (drag dans le kanban) — appelé
 *      par updateLeadStage / updateLeadStageAndAssignee.
 *   2. Modification de `next_follow_up_at` depuis le drawer —
 *      appelé par updateLead.
 *
 * Comportement :
 *   - Si pas de template pour le stage actuel OU pas de date posée
 *     → annule la tâche auto précédente (si elle existait), pas de
 *     nouvelle tâche créée.
 *   - Sinon → annule l'ancienne, crée la nouvelle avec
 *     `due_date = next_follow_up_at`, et synchronise vers Google
 *     Calendar (best-effort).
 *
 * Non bloquant : si la création/sync échoue, l'opération principale
 * (update du lead) aboutit quand même (log serveur).
 */
async function ensureLeadFollowUpTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lead: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    assigned_to: string | null;
    next_follow_up_at: string | null;
    pipeline_stage: LeadPipelineStage;
  },
  userId: string
): Promise<void> {
  const template = STAGE_TASK_TEMPLATES[lead.pipeline_stage];
  const shouldHaveTask = !!template && !!lead.next_follow_up_at;

  // 1) Récupère les IDs des tâches auto pending précédentes pour ce lead.
  //    On les sync vers GCal AVANT de DELETE pour que loadTaskEvent puisse
  //    encore les lire (status='pending') et déclencher la suppression de
  //    l'event côté Google. Une fois la sync lancée (fire-and-forget), on
  //    DELETE les rows — pas besoin de garder une trace 'cancelled' dans
  //    /dashboard/taches.
  const { data: toDelete } = await supabase
    .from("tasks")
    .select("id")
    .eq("related_type", "lead_import")
    .eq("related_id", lead.id)
    .like("auto_origin", "lead_stage:%")
    .eq("status", "pending");

  const idsToDelete = (toDelete ?? []).map((t) => t.id);
  if (idsToDelete.length > 0) {
    // Sync GCal d'abord (lit la row avant suppression)
    for (const id of idsToDelete) {
      void syncEntityToAllConnectedUsers("task", id).catch((e) =>
        console.error("[ensureLeadFollowUpTask] sync delete:", e)
      );
    }
    // Puis DELETE — laisse un instant à la sync pour lire la row.
    // En pratique syncEntityToAllConnectedUsers commence par lire le
    // mapping calendar_event_links (qui sait quel event Google supprimer),
    // donc on peut DELETE la task tout de suite.
    await supabase.from("tasks").delete().in("id", idsToDelete);
  }

  if (!shouldHaveTask) return; // pas de date posée ou stage hors scope

  // 2) Crée la nouvelle tâche avec la date posée par l'utilisateur
  const fullName =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    lead.company_name ||
    "ce prospect";

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({
      title: template.title(fullName),
      description: template.description,
      status: "pending",
      priority: template.priority,
      due_date: lead.next_follow_up_at!.slice(0, 10), // timestamptz → YYYY-MM-DD
      related_type: "lead_import",
      related_id: lead.id,
      assigned_to: lead.assigned_to ?? userId,
      auto_origin: `lead_stage:${lead.pipeline_stage}`,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[ensureLeadFollowUpTask] insert:", error?.message);
    return;
  }

  // 3) Push vers Google Calendar (best-effort, async)
  void syncEntityToAllConnectedUsers("task", inserted.id).catch((e) =>
    console.error("[ensureLeadFollowUpTask] sync insert:", e)
  );
}

/**
 * Update the kanban stage of a lead. Used by drag & drop.
 * Valid on leads in `pending` or `qualified` status — terminal statuses
 * (converted/dismissed/duplicate) exit the kanban entirely.
 *
 * Auto-sync le `status` selon la colonne de destination pour garder
 * la cohérence avec la vue liste.
 */
export async function updateLeadStage(
  leadId: string,
  stage: LeadPipelineStage
): Promise<ActionResult> {
  if (!VALID_PIPELINE_STAGES.includes(stage)) {
    return { success: false, error: "Étape invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: lead } = await supabase
    .from("lead_imports")
    .select("id, status, first_name, last_name, company_name, assigned_to, pipeline_stage, next_follow_up_at")
    .eq("id", leadId)
    .single();
  if (!lead) return { success: false, error: "Lead introuvable." };
  if (lead.status !== "pending" && lead.status !== "qualified") {
    return {
      success: false,
      error: "Ce lead a déjà été converti, rejeté ou marqué doublon.",
    };
  }

  const newStatus = stageToStatus(stage);
  const { error } = await supabase
    .from("lead_imports")
    .update({ pipeline_stage: stage, status: newStatus })
    .eq("id", leadId);
  if (error) return { success: false, error: error.message };

  // Tâche de relance déférée via after() — le drag handler côté client
  // attend uniquement le UPDATE du lead (~50ms), pas les 3+ DB roundtrips
  // de ensureLeadFollowUpTask. Sans cela, le drag perd 500ms-1s.
  if (lead.pipeline_stage !== stage) {
    const fullLead = { ...lead, pipeline_stage: stage };
    const uid = user.id;
    after(async () => {
      const sb = await createClient();
      await ensureLeadFollowUpTask(sb, fullLead, uid);
      revalidatePath("/dashboard/taches");
    });
  }

  revalidatePath("/dashboard/pipeline");
  return { success: true, data: null };
}

/**
 * Variante de `updateLeadStage` qui patche aussi `assigned_to`.
 * Utilisée par le drag & drop quand on dépose un lead sur une sous-colonne
 * « À contacter — Kylian/Lohan » : il faut écrire à la fois le stage et
 * l'owner en une seule mutation pour rester cohérent (pas de flash où le
 * lead serait `to_contact` avec son ancien owner).
 *
 * Si `assignedTo` est null, on respecte ça (peut servir à déplacer un lead
 * vers une autre colonne sans owner — pas utilisé aujourd'hui mais propre).
 */
export async function updateLeadStageAndAssignee(
  leadId: string,
  stage: LeadPipelineStage,
  assignedTo: string | null
): Promise<ActionResult> {
  if (!VALID_PIPELINE_STAGES.includes(stage)) {
    return { success: false, error: "Étape invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: lead } = await supabase
    .from("lead_imports")
    .select("id, status, first_name, last_name, company_name, assigned_to, pipeline_stage, next_follow_up_at")
    .eq("id", leadId)
    .single();
  if (!lead) return { success: false, error: "Lead introuvable." };
  if (lead.status !== "pending" && lead.status !== "qualified") {
    return {
      success: false,
      error: "Ce lead a déjà été converti, rejeté ou marqué doublon.",
    };
  }

  const newStatus = stageToStatus(stage);
  const { error } = await supabase
    .from("lead_imports")
    .update({
      pipeline_stage: stage,
      status: newStatus,
      assigned_to: assignedTo,
    })
    .eq("id", leadId);
  if (error) return { success: false, error: error.message };

  // Tâche de relance déférée via after() — même raison que updateLeadStage :
  // ne pas bloquer le drag handler sur des opérations non-critiques.
  if (lead.pipeline_stage !== stage) {
    const fullLead = {
      ...lead,
      assigned_to: assignedTo,
      pipeline_stage: stage,
    };
    const uid = user.id;
    after(async () => {
      const sb = await createClient();
      await ensureLeadFollowUpTask(sb, fullLead, uid);
      revalidatePath("/dashboard/taches");
    });
  }

  revalidatePath("/dashboard/pipeline");
  return { success: true, data: null };
}

/**
 * Mark a lead as qualified — only valid from 'pending'.
 * No-op if the lead is already in another state.
 *
 * Auto-bascule aussi le `pipeline_stage` vers 'to_contact' si le lead
 * est encore en 'brut' ou 'verified' (= pas encore positionné dans
 * la partie "qualifiée" du kanban). Sinon, on garde le stage actuel.
 */
export async function qualifyLead(leadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: lead } = await supabase
    .from("lead_imports")
    .select("id, status, pipeline_stage")
    .eq("id", leadId)
    .single();
  if (!lead) return { success: false, error: "Lead introuvable." };
  if (lead.status !== "pending") {
    return {
      success: false,
      error: "Seuls les leads à traiter peuvent être qualifiés.",
    };
  }

  const updates: { status: "qualified"; pipeline_stage?: LeadPipelineStage } = {
    status: "qualified",
  };
  const stageChanged =
    lead.pipeline_stage === "brut" || lead.pipeline_stage === "verified";
  if (stageChanged) {
    updates.pipeline_stage = "to_contact";
  }

  const { error } = await supabase
    .from("lead_imports")
    .update(updates)
    .eq("id", leadId);
  if (error) return { success: false, error: error.message };

  // `to_contact` n'a pas de template de relance auto — qualifier un lead
  // ne crée donc aucune tâche. L'utilisateur peut poser une date de relance
  // dans le drawer puis drag vers `contacted` / `stand_by` pour la générer.

  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/taches");
  return { success: true, data: null };
}

// ============================================================
// Conversion fluide : lead → contact + company + deal en un clic (#4)
// ============================================================

/**
 * Convertit un lead "en discussion" en pipeline complet : crée le
 * contact + la company (via convertLead), puis crée un deal lié en
 * stage `discussion`. Sert le bouton "→ Créer deal" depuis la card
 * kanban quand le prospect a répondu.
 */
export async function convertLeadToDeal(
  leadId: string,
  overrides?: {
    deal_title?: string;
    deal_value?: number | null;
    deal_stage?: import("@/types").DealStage;
    company_id?: string | null;
    company_name?: string;
    company_domain?: string;
  }
): Promise<
  ActionResult<{ contact_id: string; company_id: string | null; deal_id: string }>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  // 1) Lire les infos du lead pour défauts du deal
  const { data: lead } = await supabase
    .from("lead_imports")
    .select("first_name, last_name, company_name, estimated_budget")
    .eq("id", leadId)
    .single();
  if (!lead) return { success: false, error: "Lead introuvable." };

  // 2) Convertir lead → contact + company (réutilise convertLead)
  const conversionRes = await convertLead(leadId, {
    company_id: overrides?.company_id ?? undefined,
    company_name: overrides?.company_name,
    company_domain: overrides?.company_domain,
  });
  if (!conversionRes.success) return conversionRes;

  const { contact_id, company_id } = conversionRes.data;

  // 3) Créer le deal lié
  const fullName =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    lead.company_name ||
    "Nouveau prospect";
  const dealTitle =
    overrides?.deal_title?.trim() ||
    (lead.company_name ? lead.company_name : fullName);
  const dealValue =
    overrides?.deal_value !== undefined
      ? overrides.deal_value
      : lead.estimated_budget ?? null;

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .insert({
      title: dealTitle,
      stage: overrides?.deal_stage ?? "discussion",
      contact_id,
      company_id,
      value: dealValue,
      assigned_to: user.id,
      created_by: user.id,
      source_lead_id: leadId,
    })
    .select("id")
    .single();

  if (dealErr || !deal) {
    return {
      success: false,
      error: dealErr?.message ?? "Impossible de créer le deal.",
    };
  }

  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/pipeline");
  revalidatePath("/dashboard/contacts");

  return {
    success: true,
    data: { contact_id, company_id, deal_id: deal.id },
  };
}

/**
 * Cherche le deal créé depuis ce lead (via convertLeadToDeal).
 * Retourne null si aucun deal n'a été créé via cette source.
 */
export async function getLeadAssociatedDeal(
  leadId: string
): Promise<{ id: string; title: string; stage: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("id, title, stage")
    .eq("source_lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/**
 * Fetches everything needed to render the LeadDrawer details panel:
 * activities timeline, custom fields with values, attached tags,
 * et le deal associé si le lead a été converti.
 */
export async function getLeadDetails(leadId: string) {
  const [activities, tags, associatedDeal] = await Promise.all([
    getActivitiesForEntity("lead_import", leadId),
    getTagsForEntity("lead_import", leadId),
    getLeadAssociatedDeal(leadId),
  ]);
  return { activities, tags, associatedDeal };
}

/**
 * Lightweight list of profiles (id + display data) for the assignee picker.
 */
export async function listProfilesLight(): Promise<LeadAssignee[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .order("full_name", { ascending: true });
  return (data ?? []) as LeadAssignee[];
}

// ============================================================
// Batch actions (bulk select kanban)
// ============================================================
// Wrappers naïfs autour des actions unitaires. `Promise.all` lance tout
// en parallèle, on collecte les erreurs et on retourne un récap. Pas de
// transaction (Supabase RPC + n queries chacun), mais ces actions sont
// déjà idempotentes individuellement : un échec partiel laisse la DB
// dans un état cohérent (les leads traités sont bien à jour).

export interface BatchResult {
  ok: number;
  failed: number;
  errors: string[];
}

async function runBatch<T>(
  ids: string[],
  fn: (id: string) => Promise<ActionResult<T>>
): Promise<BatchResult> {
  if (ids.length === 0) return { ok: 0, failed: 0, errors: [] };
  const results = await Promise.all(ids.map(fn));
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const r of results) {
    if (r.success) ok++;
    else {
      failed++;
      if (r.error) errors.push(r.error);
    }
  }
  return { ok, failed, errors };
}

export async function dismissLeadsBatch(ids: string[]): Promise<BatchResult> {
  return runBatch(ids, dismissLead);
}

export async function qualifyLeadsBatch(ids: string[]): Promise<BatchResult> {
  // qualifyLead vérifie déjà `status='pending'` ; les leads déjà
  // qualifiés échouent silencieusement (errors.length augmente).
  return runBatch(ids, qualifyLead);
}

export async function assignLeadsBatch(
  ids: string[],
  assigneeId: string | null
): Promise<BatchResult> {
  if (ids.length === 0) return { ok: 0, failed: 0, errors: [] };
  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_imports")
    .update({ assigned_to: assigneeId })
    .in("id", ids);
  if (error) {
    return { ok: 0, failed: ids.length, errors: [error.message] };
  }
  revalidatePath("/dashboard/pipeline");
  return { ok: ids.length, failed: 0, errors: [] };
}

export async function convertLeadsToDealsBatch(
  ids: string[],
  dealStage?: import("@/types").DealStage
): Promise<BatchResult> {
  // convertLeadToDeal accepte un objet overrides ({ deal_stage, ... }).
  // Pas de transaction : si la conversion 3/5 plante, les 2 premiers
  // deals existent quand même (utile : on ne perd pas le travail).
  return runBatch(ids, (id) =>
    convertLeadToDeal(id, dealStage ? { deal_stage: dealStage } : undefined)
  );
}
