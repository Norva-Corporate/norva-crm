"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission, hasPermission } from "@/lib/permissions/server";
import {
  isReachability,
  isResult,
  ANSWERED,
  type CallEntityType,
  type CallReachability,
  type CallResult,
} from "@/lib/call-outcomes";
import { findStatMemberByEmail } from "@/lib/team";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// Colonnes sélectionnées (avec jointure rep pour affichage nom).
const SELECT_COLS =
  "id, created_at, called_at, reachability, result, rep_id, entity_type, entity_id, notes, rep:profiles!call_logs_rep_id_fkey(id, full_name)";

export interface CallLogRow {
  id: string;
  created_at: string;
  called_at: string;
  reachability: string;
  result: string | null;
  rep_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  notes: string | null;
  rep?: { id: string; full_name: string | null } | null;
}

export interface CallLogInput {
  reachability: CallReachability;
  result?: CallResult | null;
  called_at?: string | null;
  notes?: string | null;
  entity_type: CallEntityType;
  entity_id: string;
}

function entityRevalidatePath(
  entityType: CallEntityType,
  entityId: string
): string {
  // Les leads vivent dans le drawer du Pipeline ; les contacts ont une fiche.
  return entityType === "contact"
    ? `/dashboard/contacts/${entityId}`
    : "/dashboard/pipeline";
}

function normalizeRep(row: unknown): CallLogRow {
  const r = row as CallLogRow & { rep?: unknown };
  const rawRep = r.rep;
  const rep = (Array.isArray(rawRep) ? rawRep[0] : rawRep) ?? null;
  return { ...(r as object), rep } as CallLogRow;
}

// ============================================================
// Création
// ============================================================
export async function createCallLog(
  input: CallLogInput
): Promise<ActionResult<CallLogRow>> {
  const denied = await ensurePermission("calls.create");
  if (denied) return { success: false, error: denied };

  if (!isReachability(input.reachability)) {
    return { success: false, error: "Joignabilité invalide." };
  }
  // Un résultat n'a de sens que si l'appel a été décroché.
  if (input.result != null) {
    if (!isResult(input.result)) {
      return { success: false, error: "Résultat invalide." };
    }
    if (input.reachability !== ANSWERED) {
      return {
        success: false,
        error: "Un résultat ne peut être saisi que pour un appel répondu.",
      };
    }
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

  const { data: inserted, error } = await supabase
    .from("call_logs")
    .insert({
      reachability: input.reachability,
      result: input.result ?? null,
      // Si called_at non fourni → défaut now() côté DB.
      ...(input.called_at ? { called_at: input.called_at } : {}),
      rep_id: user.id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      notes: input.notes?.trim() || null,
    })
    .select(SELECT_COLS)
    .single();

  if (error || !inserted) {
    return {
      success: false,
      error: error?.message ?? "Enregistrement impossible.",
    };
  }

  revalidatePath(entityRevalidatePath(input.entity_type, input.entity_id));
  revalidatePath("/dashboard/prospection");

  return { success: true, data: normalizeRep(inserted) };
}

// ============================================================
// Suppression — auteur (sa saisie) ou admin
// ============================================================
export async function deleteCallLog(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: existing, error: fetchError } = await supabase
    .from("call_logs")
    .select("rep_id, entity_type, entity_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Appel introuvable." };
  }

  const isOwner = existing.rep_id === user.id;
  const canDeleteAny = await hasPermission("calls.delete");
  if (!isOwner && !canDeleteAny) {
    return {
      success: false,
      error: "Suppression refusée — seul l'auteur ou un admin peut supprimer.",
    };
  }

  const { error } = await supabase.from("call_logs").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  if (existing.entity_type && existing.entity_id) {
    revalidatePath(
      entityRevalidatePath(
        existing.entity_type as CallEntityType,
        existing.entity_id as string
      )
    );
  }
  revalidatePath("/dashboard/prospection");

  return { success: true, data: null };
}

// ============================================================
// Liste pour une entité (historique fiche)
// ============================================================
export async function getCallsForEntity(
  entityType: CallEntityType,
  entityId: string,
  limit = 50
): Promise<CallLogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_logs")
    .select(SELECT_COLS)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("called_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(normalizeRep);
}

// ============================================================
// Dashboard — agrégats prospection
// ============================================================
export type CallPeriod = "30d" | "90d" | "all";

export interface CallStatsFilters {
  period: CallPeriod;
  repId: string | null;
}

export interface CallRepStat {
  repId: string;
  name: string;
  accent: string | null;
  appels: number;
  repondus: number;
  rdv: number;
  devisEnvoyes: number;
  signes: number;
  tauxReponse: number | null;
}

export interface CallWeeklyStat {
  week: string;
  appels: number;
  repondus: number;
  sansReponse: number;
  rdv: number;
  aRappeler: number;
  devisAEnvoyer: number;
  devisEnvoyes: number;
  signes: number;
}

export interface CallDailyStat {
  day: string; // 'YYYY-MM-DD' (UTC)
  appels: number;
  repondus: number;
  sansReponse: number;
  rdv: number;
  aRappeler: number;
  devisAEnvoyer: number;
  devisEnvoyes: number;
  signes: number;
}

export interface CallStats {
  filters: CallStatsFilters;
  // Volume
  appels: number;
  repondus: number;
  messagerie: number;
  pasDeReponse: number;
  numeroInvalide: number;
  sansReponse: number;
  // Résultats issus de l'appel
  rdv: number;
  aRappeler: number;
  devisAEnvoyer: number;
  pasInteresse: number;
  // Conversion issue des deals (proposal / won)
  devisEnvoyes: number;
  signes: number;
  // Taux
  tauxReponse: number | null; // repondus / appels
  rdvParAppels: number | null; // rdv / appels
  rdvParRepondus: number | null; // rdv / repondus
  signesParRdv: number | null; // signes / rdv
  signesParAppels: number | null; // signes / appels
  byRep: CallRepStat[];
  weekly: CallWeeklyStat[];
  daily: CallDailyStat[];
}

function periodStartISO(period: CallPeriod): string | null {
  if (period === "all") return null;
  const days = period === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function rate(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 100) : null;
}

/** Lundi (UTC) de la semaine d'une date, format 'YYYY-MM-DD'.
 *  Aligné sur date_trunc('week', …) de Postgres (semaine ISO, lundi). */
function weekStartUTC(input: string): string {
  const d = new Date(input);
  const day = d.getUTCDay(); // 0 = dimanche … 6 = samedi
  const shift = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + shift)
  );
  return monday.toISOString().slice(0, 10);
}

/** Jour (UTC) d'une date, format 'YYYY-MM-DD'. */
function dayUTC(input: string): string {
  return new Date(input).toISOString().slice(0, 10);
}

function emptyStats(filters: CallStatsFilters): CallStats {
  return {
    filters,
    appels: 0,
    repondus: 0,
    messagerie: 0,
    pasDeReponse: 0,
    numeroInvalide: 0,
    sansReponse: 0,
    rdv: 0,
    aRappeler: 0,
    devisAEnvoyer: 0,
    pasInteresse: 0,
    devisEnvoyes: 0,
    signes: 0,
    tauxReponse: null,
    rdvParAppels: null,
    rdvParRepondus: null,
    signesParRdv: null,
    signesParAppels: null,
    byRep: [],
    weekly: [],
    daily: [],
  };
}

export async function getCallStats(
  filters: CallStatsFilters = { period: "all", repId: null }
): Promise<CallStats> {
  const denied = await ensurePermission("calls.read");
  if (denied) return emptyStats(filters);

  const supabase = await createClient();
  const startISO = periodStartISO(filters.period);

  // --- Appels (call_logs)
  let callQuery = supabase
    .from("call_logs")
    .select("reachability, result, rep_id, called_at");
  if (startISO) callQuery = callQuery.gte("called_at", startISO);
  if (filters.repId) callQuery = callQuery.eq("rep_id", filters.repId);

  // --- Conversion (deals : proposal = devis envoyé, won = signé)
  let dealQuery = supabase
    .from("deals")
    .select("stage, assigned_to, updated_at")
    .in("stage", ["proposal", "won"]);
  if (startISO) dealQuery = dealQuery.gte("updated_at", startISO);
  if (filters.repId) dealQuery = dealQuery.eq("assigned_to", filters.repId);

  // --- Vue agrégée hebdo (volume + issues par semaine/commercial)
  let weeklyQuery = supabase
    .from("v_prospection_weekly")
    .select(
      "week, rep_id, appels_passes, repondus, sans_reponse, rdv_obtenus, a_rappeler, devis_a_envoyer"
    );
  if (startISO) weeklyQuery = weeklyQuery.gte("week", weekStartUTC(startISO));
  if (filters.repId) weeklyQuery = weeklyQuery.eq("rep_id", filters.repId);

  const [
    { data: calls },
    { data: deals },
    { data: weeklyRows },
    { data: profiles },
  ] = await Promise.all([
    callQuery,
    dealQuery,
    weeklyQuery,
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const callRows = calls ?? [];
  const dealRows = deals ?? [];

  const stats = emptyStats(filters);

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p as { id: string; full_name: string | null; email: string | null },
    ])
  );

  // Accumulateur par commercial.
  const repMap = new Map<
    string,
    {
      appels: number;
      repondus: number;
      rdv: number;
      devisEnvoyes: number;
      signes: number;
    }
  >();
  const ensureRep = (id: string) => {
    let r = repMap.get(id);
    if (!r) {
      r = { appels: 0, repondus: 0, rdv: 0, devisEnvoyes: 0, signes: 0 };
      repMap.set(id, r);
    }
    return r;
  };

  // ----- Volume + résultats (call_logs)
  for (const c of callRows) {
    stats.appels += 1;
    const reach = c.reachability as string;
    if (reach === "repondu") stats.repondus += 1;
    else if (reach === "messagerie") stats.messagerie += 1;
    else if (reach === "pas_de_reponse") stats.pasDeReponse += 1;
    else if (reach === "numero_invalide") stats.numeroInvalide += 1;

    const result = c.result as string | null;
    if (result === "rdv") stats.rdv += 1;
    else if (result === "rappel") stats.aRappeler += 1;
    else if (result === "devis") stats.devisAEnvoyer += 1;
    else if (result === "pas_interesse") stats.pasInteresse += 1;

    if (c.rep_id) {
      const r = ensureRep(c.rep_id as string);
      r.appels += 1;
      if (reach === "repondu") r.repondus += 1;
      if (result === "rdv") r.rdv += 1;
    }
  }
  stats.sansReponse =
    stats.messagerie + stats.pasDeReponse + stats.numeroInvalide;

  // ----- Conversion (deals)
  for (const d of dealRows) {
    const stage = d.stage as string;
    if (stage === "proposal") stats.devisEnvoyes += 1;
    else if (stage === "won") stats.signes += 1;
    if (d.assigned_to) {
      const r = ensureRep(d.assigned_to as string);
      if (stage === "proposal") r.devisEnvoyes += 1;
      else if (stage === "won") r.signes += 1;
    }
  }

  // ----- Taux globaux
  stats.tauxReponse = rate(stats.repondus, stats.appels);
  stats.rdvParAppels = rate(stats.rdv, stats.appels);
  stats.rdvParRepondus = rate(stats.rdv, stats.repondus);
  stats.signesParRdv = rate(stats.signes, stats.rdv);
  stats.signesParAppels = rate(stats.signes, stats.appels);

  // ----- Par commercial (résolution nom via STAT_MEMBERS)
  stats.byRep = Array.from(repMap.entries())
    .map(([repId, v]) => {
      const profile = profileById.get(repId);
      const owner = findStatMemberByEmail(profile?.email);
      return {
        repId,
        name: owner?.shortName ?? profile?.full_name ?? profile?.email ?? "—",
        accent: owner?.accent ?? null,
        appels: v.appels,
        repondus: v.repondus,
        rdv: v.rdv,
        devisEnvoyes: v.devisEnvoyes,
        signes: v.signes,
        tauxReponse: rate(v.repondus, v.appels),
      };
    })
    .sort((a, b) => b.appels - a.appels);

  // ----- Récap hebdomadaire (vue call_logs + conversions deals fusionnées)
  const weekMap = new Map<string, CallWeeklyStat>();
  const ensureWeek = (week: string) => {
    let w = weekMap.get(week);
    if (!w) {
      w = {
        week,
        appels: 0,
        repondus: 0,
        sansReponse: 0,
        rdv: 0,
        aRappeler: 0,
        devisAEnvoyer: 0,
        devisEnvoyes: 0,
        signes: 0,
      };
      weekMap.set(week, w);
    }
    return w;
  };

  for (const row of weeklyRows ?? []) {
    const week = String(row.week);
    const w = ensureWeek(week);
    w.appels += Number(row.appels_passes) || 0;
    w.repondus += Number(row.repondus) || 0;
    w.sansReponse += Number(row.sans_reponse) || 0;
    w.rdv += Number(row.rdv_obtenus) || 0;
    w.aRappeler += Number(row.a_rappeler) || 0;
    w.devisAEnvoyer += Number(row.devis_a_envoyer) || 0;
  }

  // Conversions deals attribuées à la semaine de leur dernier changement d'étape.
  for (const d of dealRows) {
    if (!d.updated_at) continue;
    const week = weekStartUTC(d.updated_at as string);
    const w = ensureWeek(week);
    if (d.stage === "proposal") w.devisEnvoyes += 1;
    else if (d.stage === "won") w.signes += 1;
  }

  stats.weekly = Array.from(weekMap.values()).sort((a, b) =>
    a.week < b.week ? 1 : a.week > b.week ? -1 : 0
  );

  // ----- Récap journalier (call_logs bruts + conversions deals, groupés par jour)
  const dayMap = new Map<string, CallDailyStat>();
  const ensureDay = (day: string) => {
    let d = dayMap.get(day);
    if (!d) {
      d = {
        day,
        appels: 0,
        repondus: 0,
        sansReponse: 0,
        rdv: 0,
        aRappeler: 0,
        devisAEnvoyer: 0,
        devisEnvoyes: 0,
        signes: 0,
      };
      dayMap.set(day, d);
    }
    return d;
  };

  for (const c of callRows) {
    if (!c.called_at) continue;
    const d = ensureDay(dayUTC(c.called_at as string));
    d.appels += 1;
    const reach = c.reachability as string;
    if (reach === "repondu") d.repondus += 1;
    else if (
      reach === "messagerie" ||
      reach === "pas_de_reponse" ||
      reach === "numero_invalide"
    )
      d.sansReponse += 1;
    const result = c.result as string | null;
    if (result === "rdv") d.rdv += 1;
    else if (result === "rappel") d.aRappeler += 1;
    else if (result === "devis") d.devisAEnvoyer += 1;
  }

  for (const d of dealRows) {
    if (!d.updated_at) continue;
    const day = ensureDay(dayUTC(d.updated_at as string));
    if (d.stage === "proposal") day.devisEnvoyes += 1;
    else if (d.stage === "won") day.signes += 1;
  }

  stats.daily = Array.from(dayMap.values()).sort((a, b) =>
    a.day < b.day ? 1 : a.day > b.day ? -1 : 0
  );

  return stats;
}
