"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/permissions/server";

// ============================================================
// Goals — types
// ============================================================
export type GoalScope = "team" | "individual";
export type GoalMetric =
  | "deals_won"
  | "revenue_collected"
  | "leads_qualified";
export type GoalPeriod = "week" | "month" | "quarter" | "year";
export type GoalStatus = "active" | "archived";

export interface Goal {
  id: string;
  scope: GoalScope;
  owner_profile_id: string | null;
  title: string;
  description: string | null;
  metric_type: GoalMetric;
  target_value: number;
  period_type: GoalPeriod;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  status: GoalStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalInput {
  scope: GoalScope;
  owner_profile_id: string | null;
  title: string;
  description?: string | null;
  metric_type: GoalMetric;
  target_value: number;
  period_type: GoalPeriod;
  period_start: string;
  period_end: string;
}

export interface GoalWithProgress extends Goal {
  current_value: number;
  progress_pct: number; // 0-100
  days_remaining: number; // négatif si la période est passée
  on_track: boolean; // true si progress_pct >= (jours écoulés / durée totale * 100)
  owner_name: string | null;
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const VALID_SCOPES: GoalScope[] = ["team", "individual"];
const VALID_METRICS: GoalMetric[] = [
  "deals_won",
  "revenue_collected",
  "leads_qualified",
];
const VALID_PERIODS: GoalPeriod[] = ["week", "month", "quarter", "year"];

// ============================================================
// CRUD
// ============================================================
function validate(input: GoalInput): string | null {
  if (!input.title?.trim()) return "Le titre est obligatoire.";
  if (!VALID_SCOPES.includes(input.scope)) return "Scope invalide.";
  if (input.scope === "individual" && !input.owner_profile_id)
    return "Un objectif individuel requiert un membre.";
  if (input.scope === "team" && input.owner_profile_id)
    return "Un objectif d'équipe ne doit pas avoir de membre assigné.";
  if (!VALID_METRICS.includes(input.metric_type))
    return "Métrique invalide.";
  if (!VALID_PERIODS.includes(input.period_type))
    return "Période invalide.";
  if (!input.target_value || input.target_value <= 0)
    return "La valeur cible doit être > 0.";
  if (!input.period_start || !input.period_end)
    return "Dates de période manquantes.";
  if (input.period_end < input.period_start)
    return "La date de fin doit être ≥ à la date de début.";
  return null;
}

export async function listGoals(): Promise<Goal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("status", { ascending: true })
    .order("period_end", { ascending: false });
  if (error || !data) {
    console.error("[goals] listGoals:", error);
    return [];
  }
  return data as unknown as Goal[];
}

export async function createGoal(
  input: GoalInput
): Promise<ActionResult<{ id: string }>> {
  const denied = await ensurePermission("goals.create");
  if (denied) return { success: false, error: denied };

  const err = validate(input);
  if (err) return { success: false, error: err };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data, error } = await supabase
    .from("goals")
    .insert({
      ...input,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }
  revalidatePath("/dashboard/objectifs");
  return { success: true, data: { id: data.id } };
}

export async function updateGoal(
  id: string,
  input: GoalInput
): Promise<ActionResult> {
  const denied = await ensurePermission("goals.update");
  if (denied) return { success: false, error: denied };

  const err = validate(input);
  if (err) return { success: false, error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      ...input,
      title: input.title.trim(),
      description: input.description?.trim() || null,
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/objectifs");
  return { success: true, data: null };
}

export async function archiveGoal(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("goals.archive");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/objectifs");
  return { success: true, data: null };
}

export async function reactivateGoal(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("goals.update");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status: "active" })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/objectifs");
  return { success: true, data: null };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("goals.delete");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/objectifs");
  return { success: true, data: null };
}

// ============================================================
// PROGRESS — recalculé à chaque chargement
// ============================================================
/**
 * Calcule la valeur courante d'une métrique sur une période + owner.
 * `ownerId` null = scope team (pas de filtre assigned_to).
 *
 * - deals_won         : COUNT deals.stage='won' AND updated_at ∈ période
 * - revenue_collected : SUM invoices.total payées AND issue_date ∈ période
 * - leads_qualified   : COUNT lead_imports.status='qualified' AND stage_updated_at ∈ période
 *
 * Toutes les queries utilisent `head: true` + `count: 'exact'` pour
 * minimiser le payload (on ne ramène pas les rows).
 */
async function computeMetric(
  supabase: Awaited<ReturnType<typeof createClient>>,
  metric: GoalMetric,
  ownerId: string | null,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  // periodEnd inclus → upper bound = J+1 pour les comparaisons ts.
  const endExclusive = new Date(periodEnd);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const endExclusiveISO = endExclusive.toISOString().split("T")[0];

  if (metric === "deals_won") {
    let q = supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("stage", "won")
      .gte("updated_at", periodStart)
      .lt("updated_at", endExclusiveISO);
    if (ownerId) q = q.eq("assigned_to", ownerId);
    const { count } = await q;
    return count ?? 0;
  }

  if (metric === "leads_qualified") {
    let q = supabase
      .from("lead_imports")
      .select("id", { count: "exact", head: true })
      .eq("status", "qualified")
      .gte("stage_updated_at", periodStart)
      .lt("stage_updated_at", endExclusiveISO);
    if (ownerId) q = q.eq("assigned_to", ownerId);
    const { count } = await q;
    return count ?? 0;
  }

  if (metric === "revenue_collected") {
    // Pas d'assigned_to direct sur invoices → on filtre via deals si owner.
    // V1 : scope team uniquement pour revenue. Si ownerId set sur un goal
    // 'individual revenue', on warne mais on retourne le total team.
    // V2 : ajouter une colonne deals.owner_id puis JOIN invoices→deals→owner.
    const { data } = await supabase
      .from("invoices")
      .select("total")
      .eq("type", "invoice")
      .eq("status", "payee")
      .gte("issue_date", periodStart)
      .lt("issue_date", endExclusiveISO);
    return (data ?? []).reduce(
      (sum, row) => sum + (Number(row.total) || 0),
      0
    );
  }

  return 0;
}

export async function getGoalsWithProgress(): Promise<GoalWithProgress[]> {
  const supabase = await createClient();
  const { data: goals, error } = await supabase
    .from("goals")
    .select("*")
    .order("status", { ascending: true })
    .order("period_end", { ascending: false });
  if (error || !goals) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email");
  const profilesById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p.full_name ?? p.email ?? null,
    ])
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Recalcule chaque métrique en parallèle.
  const enriched = await Promise.all(
    (goals as Goal[]).map(async (g) => {
      const current_value = await computeMetric(
        supabase,
        g.metric_type,
        g.owner_profile_id,
        g.period_start,
        g.period_end
      );
      const progress_pct = Math.min(
        100,
        Math.round((current_value / g.target_value) * 100)
      );

      const start = new Date(g.period_start);
      const end = new Date(g.period_end);
      const totalDays = Math.max(
        1,
        Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      const daysElapsed = Math.max(
        0,
        Math.min(
          totalDays,
          Math.round(
            (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          )
        )
      );
      const days_remaining = Math.round(
        (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // "On track" = progress_pct atteint ou dépasse le ratio temps écoulé.
      const expectedPct = (daysElapsed / totalDays) * 100;
      const on_track = progress_pct >= expectedPct - 5; // tolérance 5pt

      return {
        ...g,
        current_value,
        progress_pct,
        days_remaining,
        on_track,
        owner_name: g.owner_profile_id
          ? profilesById.get(g.owner_profile_id) ?? null
          : null,
      };
    })
  );

  return enriched;
}
