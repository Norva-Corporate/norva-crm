"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getActivitiesForEntity,
} from "@/lib/actions/activities";
import { getFieldsWithValues } from "@/lib/actions/custom-fields";
import { getTagsForEntity } from "@/lib/actions/tags";

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
  revalidatePath("/dashboard/leads");
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
// Quand un lead change de stage, on crée auto une tâche pour ne rien
// oublier. Avant de créer, on annule la tâche pending précédente
// auto-créée pour ce lead (dédup via `tasks.auto_origin`).

type StageTaskTemplate = {
  title: (fullName: string) => string;
  description: string;
  priority: "normal" | "high" | "urgent";
  /** Days from now */
  due_in: number;
};

const STAGE_TASK_TEMPLATES: Partial<
  Record<LeadPipelineStage, StageTaskTemplate>
> = {
  to_contact: {
    title: (name) => `Appeler ${name}`,
    description: "Premier contact — utilise le kit ✉️ généré si dispo.",
    priority: "high",
    due_in: 1,
  },
  to_email: {
    title: (name) => `Envoyer un email à ${name}`,
    description: "Cold email à envoyer — utilise le kit ✉️ si dispo.",
    priority: "high",
    due_in: 2,
  },
  contacted: {
    title: (name) => `Relancer ${name}`,
    description: "Vérifier la réponse au cold outreach.",
    priority: "normal",
    due_in: 5,
  },
  in_discussion: {
    title: (name) => `Préparer proposition pour ${name}`,
    description: "Le prospect a répondu — prépare l'offre.",
    priority: "high",
    due_in: 3,
  },
  stand_by: {
    title: (name) => `Recontacter ${name}`,
    description: "Lead parké — relance prévue après ~1 mois de pause.",
    priority: "normal",
    due_in: 30,
  },
};

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Crée la tâche auto liée à un nouveau stage. Annule la précédente
 * tâche auto pending pour ce lead (dédup propre).
 * Non bloquant : si la création échoue, le drag du lead aboutit quand
 * même (log côté serveur).
 */
async function createStageTask(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lead: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    assigned_to: string | null;
  },
  stage: LeadPipelineStage,
  userId: string
): Promise<void> {
  const template = STAGE_TASK_TEMPLATES[stage];
  if (!template) return; // brut / verified : pas de tâche

  // 1) Annule les tâches auto pending précédentes pour ce lead
  await supabase
    .from("tasks")
    .update({ status: "cancelled" })
    .eq("related_type", "lead_import")
    .eq("related_id", lead.id)
    .like("auto_origin", "lead_stage:%")
    .eq("status", "pending");

  // 2) Crée la nouvelle tâche
  const fullName =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    lead.company_name ||
    "ce prospect";

  const { error } = await supabase.from("tasks").insert({
    title: template.title(fullName),
    description: template.description,
    status: "pending",
    priority: template.priority,
    due_date: addDays(new Date(), template.due_in),
    related_type: "lead_import",
    related_id: lead.id,
    assigned_to: lead.assigned_to ?? userId,
    auto_origin: `lead_stage:${stage}`,
    created_by: userId,
  });

  if (error) {
    console.error("[createStageTask] failed:", error.message);
  }
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
    .select("id, status, first_name, last_name, company_name, assigned_to, pipeline_stage")
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

  // Crée la tâche auto liée au nouveau stage (si applicable)
  if (lead.pipeline_stage !== stage) {
    await createStageTask(supabase, lead, stage, user.id);
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/taches");
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
    .select("id, status, first_name, last_name, company_name, assigned_to, pipeline_stage")
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

  // Crée la tâche auto liée au nouveau stage (avec le nouvel assignee)
  if (lead.pipeline_stage !== stage) {
    await createStageTask(
      supabase,
      { ...lead, assigned_to: assignedTo },
      stage,
      user.id
    );
  }

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/taches");
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
    .select("id, status, pipeline_stage, first_name, last_name, company_name, assigned_to")
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

  // Si on a basculé en 'to_contact', créer la tâche auto associée
  if (stageChanged) {
    await createStageTask(supabase, lead, "to_contact", user.id);
  }

  revalidatePath("/dashboard/leads");
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
      stage: "discussion",
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

  revalidatePath("/dashboard/leads");
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
  const [activities, customFields, tags, associatedDeal] = await Promise.all([
    getActivitiesForEntity("lead_import", leadId),
    getFieldsWithValues("lead_import", leadId),
    getTagsForEntity("lead_import", leadId),
    getLeadAssociatedDeal(leadId),
  ]);
  return { activities, customFields, tags, associatedDeal };
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
