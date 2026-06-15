"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission, hasPermission } from "@/lib/permissions/server";
import {
  OBJECTION_CATALOG,
  STAGES,
  STAGE_ORDER,
  OUTCOMES,
  getObjection,
  isObjectionId,
  type ObjectionEntityType,
  type ObjectionOutcome,
  type ObjectionStage,
} from "@/lib/objections";
import { findOwnerByEmail } from "@/lib/team";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// Colonnes sélectionnées (avec jointure rep pour affichage nom).
const SELECT_COLS =
  "id, created_at, objection_id, objection_label, stage, outcome, pain_id, rep_id, entity_type, entity_id, notes, rep:profiles!objection_logs_rep_id_fkey(id, full_name)";

export interface ObjectionLogRow {
  id: string;
  created_at: string;
  objection_id: string;
  objection_label: string | null;
  stage: string;
  outcome: string | null;
  pain_id: string | null;
  rep_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  notes: string | null;
  rep?: { id: string; full_name: string | null } | null;
}

export interface ObjectionLogInput {
  objection_id: string;
  outcome: ObjectionOutcome | null;
  pain_id?: string | null;
  notes?: string | null;
  entity_type: ObjectionEntityType;
  entity_id: string;
}

function entityRevalidatePath(
  entityType: ObjectionEntityType,
  entityId: string
): string {
  return entityType === "contact"
    ? `/dashboard/contacts/${entityId}`
    : "/dashboard/pipeline";
}

function normalizeRep(row: unknown): ObjectionLogRow {
  const r = row as ObjectionLogRow & { rep?: unknown };
  const rawRep = r.rep;
  const rep = (Array.isArray(rawRep) ? rawRep[0] : rawRep) ?? null;
  return { ...(r as object), rep } as ObjectionLogRow;
}

// ============================================================
// Création
// ============================================================
export async function createObjectionLog(
  input: ObjectionLogInput
): Promise<ActionResult<ObjectionLogRow>> {
  const denied = await ensurePermission("objections.create");
  if (denied) return { success: false, error: denied };

  if (!isObjectionId(input.objection_id)) {
    return { success: false, error: "Objection inconnue." };
  }
  if (input.outcome != null && !(input.outcome in OUTCOMES)) {
    return { success: false, error: "Issue invalide." };
  }
  if (input.entity_type !== "lead_import" && input.entity_type !== "contact") {
    return { success: false, error: "Type d'entité non supporté." };
  }
  if (!input.entity_id) {
    return { success: false, error: "Entité manquante." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  // Label + stage dérivés du catalogue (source de vérité server-side).
  const catalog = getObjection(input.objection_id)!;

  const { data: inserted, error } = await supabase
    .from("objection_logs")
    .insert({
      objection_id: input.objection_id,
      objection_label: catalog.label,
      stage: catalog.stage,
      outcome: input.outcome,
      pain_id: input.pain_id?.trim() || null,
      rep_id: user.id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      notes: input.notes?.trim() || null,
    })
    .select(SELECT_COLS)
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Enregistrement impossible." };
  }

  revalidatePath(entityRevalidatePath(input.entity_type, input.entity_id));
  revalidatePath("/dashboard/objections");

  return { success: true, data: normalizeRep(inserted) };
}

// ============================================================
// Suppression — auteur (sa saisie) ou admin
// ============================================================
export async function deleteObjectionLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: existing, error: fetchError } = await supabase
    .from("objection_logs")
    .select("rep_id, entity_type, entity_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Objection introuvable." };
  }

  const isOwner = existing.rep_id === user.id;
  const canDeleteAny = await hasPermission("objections.delete");
  if (!isOwner && !canDeleteAny) {
    return {
      success: false,
      error: "Suppression refusée — seul l'auteur ou un admin peut supprimer.",
    };
  }

  const { error } = await supabase.from("objection_logs").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  if (existing.entity_type && existing.entity_id) {
    revalidatePath(
      entityRevalidatePath(
        existing.entity_type as ObjectionEntityType,
        existing.entity_id as string
      )
    );
  }
  revalidatePath("/dashboard/objections");

  return { success: true, data: null };
}

// ============================================================
// Liste pour une entité (historique fiche)
// ============================================================
export async function getObjectionsForEntity(
  entityType: ObjectionEntityType,
  entityId: string,
  limit = 50
): Promise<ObjectionLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("objection_logs")
    .select(SELECT_COLS)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(normalizeRep);
}

// ============================================================
// Dashboard — agrégats
// ============================================================
export type ObjectionPeriod = "30d" | "90d" | "all";

export interface ObjectionStatsFilters {
  period: ObjectionPeriod;
  repId: string | null;
}

export interface ObjectionStats {
  filters: ObjectionStatsFilters;
  total: number;
  withOutcome: number;
  accepted: number;
  closingRate: number | null;
  topObjection: { id: string; label: string; count: number } | null;
  busiestStage: { stage: ObjectionStage; label: string; count: number } | null;
  byObjection: {
    id: string;
    label: string;
    stage: string;
    accepte: number;
    hesite: number;
    refuse: number;
    total: number;
  }[];
  byStage: {
    stage: ObjectionStage;
    label: string;
    total: number;
    accepte: number;
    withOutcome: number;
    closingRate: number | null;
  }[];
  byRep: {
    repId: string;
    name: string;
    accent: string | null;
    total: number;
    accepte: number;
    withOutcome: number;
    closingRate: number | null;
  }[];
  byPain: { painId: string; total: number; accepte: number }[];
}

function periodStartISO(period: ObjectionPeriod): string | null {
  if (period === "all") return null;
  const days = period === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function rate(accepte: number, withOutcome: number): number | null {
  return withOutcome > 0 ? Math.round((accepte / withOutcome) * 100) : null;
}

export async function getObjectionStats(
  filters: ObjectionStatsFilters = { period: "all", repId: null }
): Promise<ObjectionStats> {
  const empty: ObjectionStats = {
    filters,
    total: 0,
    withOutcome: 0,
    accepted: 0,
    closingRate: null,
    topObjection: null,
    busiestStage: null,
    byObjection: [],
    byStage: [],
    byRep: [],
    byPain: [],
  };

  const denied = await ensurePermission("objections.read");
  if (denied) return empty;

  const supabase = await createClient();

  let query = supabase
    .from("objection_logs")
    .select("objection_id, objection_label, stage, outcome, pain_id, rep_id");

  const startISO = periodStartISO(filters.period);
  if (startISO) query = query.gte("created_at", startISO);
  if (filters.repId) query = query.eq("rep_id", filters.repId);

  const [{ data: rows }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const logs = rows ?? [];
  if (logs.length === 0) return empty;

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p as { id: string; full_name: string | null; email: string | null }])
  );

  // ----- Par objection
  const objMap = new Map<
    string,
    { id: string; label: string; stage: string; accepte: number; hesite: number; refuse: number; total: number }
  >();
  // ----- Par étape
  const stageMap = new Map<ObjectionStage, { total: number; accepte: number; withOutcome: number }>();
  for (const s of STAGE_ORDER) stageMap.set(s, { total: 0, accepte: 0, withOutcome: 0 });
  // ----- Par rep
  const repMap = new Map<string, { total: number; accepte: number; withOutcome: number }>();
  // ----- Par pain
  const painMap = new Map<string, { total: number; accepte: number }>();

  let withOutcome = 0;
  let accepted = 0;

  for (const r of logs) {
    const outcome = r.outcome as string | null;
    const isAccepted = outcome === "accepte";
    const hasOutcome = outcome != null;
    if (hasOutcome) withOutcome += 1;
    if (isAccepted) accepted += 1;

    // objection
    const oid = r.objection_id as string;
    const catalog = OBJECTION_CATALOG[oid as keyof typeof OBJECTION_CATALOG];
    const label = (r.objection_label as string | null) ?? catalog?.label ?? oid;
    const stage = (r.stage as string) ?? catalog?.stage ?? "annexes";
    const o = objMap.get(oid) ?? { id: oid, label, stage, accepte: 0, hesite: 0, refuse: 0, total: 0 };
    o.total += 1;
    if (outcome === "accepte") o.accepte += 1;
    else if (outcome === "hesite") o.hesite += 1;
    else if (outcome === "refuse") o.refuse += 1;
    objMap.set(oid, o);

    // stage
    const stKey = (stage in STAGES ? stage : "annexes") as ObjectionStage;
    const st = stageMap.get(stKey)!;
    st.total += 1;
    if (hasOutcome) st.withOutcome += 1;
    if (isAccepted) st.accepte += 1;

    // rep
    if (r.rep_id) {
      const rp = repMap.get(r.rep_id) ?? { total: 0, accepte: 0, withOutcome: 0 };
      rp.total += 1;
      if (hasOutcome) rp.withOutcome += 1;
      if (isAccepted) rp.accepte += 1;
      repMap.set(r.rep_id, rp);
    }

    // pain
    const pain = (r.pain_id as string | null)?.trim();
    if (pain) {
      const pm = painMap.get(pain) ?? { total: 0, accepte: 0 };
      pm.total += 1;
      if (isAccepted) pm.accepte += 1;
      painMap.set(pain, pm);
    }
  }

  const byObjection = Array.from(objMap.values()).sort((a, b) => b.total - a.total);

  const byStage = STAGE_ORDER.map((stage) => {
    const v = stageMap.get(stage)!;
    return {
      stage,
      label: STAGES[stage],
      total: v.total,
      accepte: v.accepte,
      withOutcome: v.withOutcome,
      closingRate: rate(v.accepte, v.withOutcome),
    };
  });

  const byRep = Array.from(repMap.entries())
    .map(([repId, v]) => {
      const profile = profileById.get(repId);
      const owner = findOwnerByEmail(profile?.email);
      return {
        repId,
        name: owner?.shortName ?? profile?.full_name ?? profile?.email ?? "—",
        accent: owner?.accent ?? null,
        total: v.total,
        accepte: v.accepte,
        withOutcome: v.withOutcome,
        closingRate: rate(v.accepte, v.withOutcome),
      };
    })
    .sort((a, b) => b.total - a.total);

  const byPain = Array.from(painMap.entries())
    .map(([painId, v]) => ({ painId, total: v.total, accepte: v.accepte }))
    .sort((a, b) => b.total - a.total);

  const topObjection = byObjection.length
    ? { id: byObjection[0].id, label: byObjection[0].label, count: byObjection[0].total }
    : null;

  const busiestStage = [...byStage].sort((a, b) => b.total - a.total)[0];

  return {
    filters,
    total: logs.length,
    withOutcome,
    accepted,
    closingRate: rate(accepted, withOutcome),
    topObjection,
    busiestStage:
      busiestStage && busiestStage.total > 0
        ? { stage: busiestStage.stage, label: busiestStage.label, count: busiestStage.total }
        : null,
    byObjection,
    byStage,
    byRep,
    byPain,
  };
}
