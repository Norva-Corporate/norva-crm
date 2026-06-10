"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityEntityType, ActivityType } from "@/types";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ActivityInput {
  type: ActivityType | string;
  entity_type: ActivityEntityType;
  entity_id: string;
  payload?: Record<string, unknown> | null;
}

const MANUAL_TYPES = new Set(["note", "call", "meeting", "email"]);

export async function createActivity(
  data: ActivityInput
): Promise<ActionResult<Activity>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  if (!MANUAL_TYPES.has(data.type)) {
    return {
      success: false,
      error: "Type d'activité non autorisé pour la création manuelle.",
    };
  }

  const { data: inserted, error } = await supabase
    .from("activities")
    .insert({
      type: data.type,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      payload: data.payload ?? null,
      created_by: user.id,
    })
    .select(
      "id, type, entity_type, entity_id, payload, created_by, created_at, author:profiles!activities_created_by_fkey(id, full_name, avatar_url)"
    )
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }

  const map: Record<ActivityEntityType, string> = {
    contact: `/dashboard/contacts/${data.entity_id}`,
    company: `/dashboard/companies/${data.entity_id}`,
    deal: "/dashboard/pipeline",
    project: `/dashboard/projets/${data.entity_id}`,
    invoice: `/dashboard/facturation/${data.entity_id}`,
    lead_import: "/dashboard/leads",
  };
  revalidatePath(map[data.entity_type]);

  // Normalise author (la jointure fk peut revenir en tableau) pour que la
  // timeline insère la ligne complète localement, sans re-fetch ni reload.
  const rawAuthor = (inserted as { author?: unknown }).author;
  const author = (Array.isArray(rawAuthor) ? rawAuthor[0] : rawAuthor) ?? null;
  return {
    success: true,
    data: { ...(inserted as object), author } as Activity,
  };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  // Fetch first to know which path to revalidate.
  const { data: existing, error: fetchError } = await supabase
    .from("activities")
    .select("entity_type, entity_id")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Activité introuvable." };
  }

  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) {
    return { success: false, error: error.message };
  }

  const entityType = existing.entity_type as ActivityEntityType;
  const entityId = existing.entity_id as string;
  const map: Record<ActivityEntityType, string> = {
    contact: `/dashboard/contacts/${entityId}`,
    company: `/dashboard/companies/${entityId}`,
    deal: "/dashboard/pipeline",
    project: `/dashboard/projets/${entityId}`,
    invoice: `/dashboard/facturation/${entityId}`,
    lead_import: "/dashboard/leads",
  };
  revalidatePath(map[entityType]);

  return { success: true, data: null };
}

export async function getActivitiesForEntity(
  entityType: ActivityEntityType,
  entityId: string,
  limit = 20
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, type, entity_type, entity_id, payload, created_by, created_at, author:profiles!activities_created_by_fkey(id, full_name, avatar_url)"
    )
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data ?? [];
}
