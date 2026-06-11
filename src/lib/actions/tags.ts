"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/permissions/server";
import type { Tag, TagEntityType } from "@/types";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const HEX = /^#[0-9A-Fa-f]{6}$/;
const VALID_ENTITY: TagEntityType[] = [
  "contact",
  "company",
  "deal",
  "project",
  "lead_import",
];

const REVALIDATE_MAP: Record<TagEntityType, (id: string) => string[]> = {
  contact: (id) => [`/dashboard/contacts/${id}`, "/dashboard/contacts"],
  company: (id) => [`/dashboard/companies/${id}`, "/dashboard/companies"],
  deal: () => ["/dashboard/pipeline"],
  project: (id) => [`/dashboard/projets/${id}`, "/dashboard/projets"],
  lead_import: () => ["/dashboard/leads"],
};

function revalidateForEntity(entityType: TagEntityType, entityId: string) {
  for (const path of REVALIDATE_MAP[entityType](entityId)) {
    revalidatePath(path);
  }
}

export async function listTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });
  return (data ?? []) as Tag[];
}

export async function getTagsForEntity(
  entityType: TagEntityType,
  entityId: string
): Promise<Tag[]> {
  if (!VALID_ENTITY.includes(entityType)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_tags")
    .select("tag:tags(*)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (!data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data
    .map((row) => {
      const t = (row as { tag: Tag | Tag[] | null }).tag;
      return Array.isArray(t) ? t[0] : t;
    })
    .filter((t): t is Tag => !!t)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTagsForEntities(
  entityType: TagEntityType,
  entityIds: string[]
): Promise<Record<string, Tag[]>> {
  if (entityIds.length === 0 || !VALID_ENTITY.includes(entityType)) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("entity_tags")
    .select("entity_id, tag:tags(*)")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);
  const result: Record<string, Tag[]> = {};
  for (const row of data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as { entity_id: string; tag: Tag | Tag[] | null };
    const t = Array.isArray(r.tag) ? r.tag[0] : r.tag;
    if (!t) continue;
    (result[r.entity_id] ??= []).push(t);
  }
  for (const id of Object.keys(result)) {
    result[id].sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}

export async function createTag(input: {
  name: string;
  color?: string;
}): Promise<ActionResult<Tag>> {
  const denied = await ensurePermission("tags.manage");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const name = input.name.trim();
  if (!name) return { success: false, error: "Nom requis." };
  const color = input.color && HEX.test(input.color) ? input.color : "#3B7BF5";

  // Try fetch existing (case-insensitive)
  const { data: existing } = await supabase
    .from("tags")
    .select("*")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return { success: true, data: existing as Tag };

  const { data, error } = await supabase
    .from("tags")
    .insert({ name, color, created_by: user.id })
    .select("*")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }
  revalidatePath("/dashboard");
  return { success: true, data: data as Tag };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("tags.manage");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard");
  return { success: true, data: null };
}

export async function attachTag(
  tagId: string,
  entityType: TagEntityType,
  entityId: string
): Promise<ActionResult> {
  if (!VALID_ENTITY.includes(entityType)) {
    return { success: false, error: "Type d'entité invalide." };
  }
  const denied = await ensurePermission("tags.manage");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase
    .from("entity_tags")
    .upsert(
      { tag_id: tagId, entity_type: entityType, entity_id: entityId },
      { onConflict: "tag_id,entity_type,entity_id", ignoreDuplicates: true }
    );
  if (error) return { success: false, error: error.message };
  revalidateForEntity(entityType, entityId);
  return { success: true, data: null };
}

export async function detachTag(
  tagId: string,
  entityType: TagEntityType,
  entityId: string
): Promise<ActionResult> {
  if (!VALID_ENTITY.includes(entityType)) {
    return { success: false, error: "Type d'entité invalide." };
  }
  const denied = await ensurePermission("tags.manage");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase
    .from("entity_tags")
    .delete()
    .eq("tag_id", tagId)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) return { success: false, error: error.message };
  revalidateForEntity(entityType, entityId);
  return { success: true, data: null };
}
