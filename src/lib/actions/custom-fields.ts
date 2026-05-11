"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  CustomFieldDefinition,
  CustomFieldEntityType,
  CustomFieldType,
  CustomFieldWithValue,
} from "@/types";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_ENTITY: CustomFieldEntityType[] = [
  "contact",
  "company",
  "deal",
  "project",
  "lead_import",
];

const VALID_FIELD_TYPE: CustomFieldType[] = [
  "text",
  "number",
  "date",
  "select",
  "url",
  "boolean",
];

const REVALIDATE_MAP: Record<
  CustomFieldEntityType,
  (id?: string) => string[]
> = {
  contact: (id) => [
    "/dashboard/contacts",
    ...(id ? [`/dashboard/contacts/${id}`] : []),
  ],
  company: (id) => [
    "/dashboard/companies",
    ...(id ? [`/dashboard/companies/${id}`] : []),
  ],
  deal: () => ["/dashboard/pipeline"],
  project: (id) => [
    "/dashboard/projets",
    ...(id ? [`/dashboard/projets/${id}`] : []),
  ],
  lead_import: () => ["/dashboard/leads"],
};

function revalidate(entityType: CustomFieldEntityType, entityId?: string) {
  for (const path of REVALIDATE_MAP[entityType](entityId)) {
    revalidatePath(path);
  }
}

function deserializeDef(raw: Record<string, unknown>): CustomFieldDefinition {
  let options: string[] | null = null;
  if (raw.options) {
    try {
      const parsed =
        typeof raw.options === "string"
          ? JSON.parse(raw.options)
          : raw.options;
      options = Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : null;
    } catch {
      options = null;
    }
  }
  return { ...(raw as object), options } as CustomFieldDefinition;
}

// ── Définitions ──────────────────────────────────────────────────────────────

export async function listFieldDefinitions(
  entityType: CustomFieldEntityType
): Promise<CustomFieldDefinition[]> {
  if (!VALID_ENTITY.includes(entityType)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_field_definitions")
    .select("*")
    .eq("entity_type", entityType)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(deserializeDef);
}

export async function createFieldDefinition(input: {
  entity_type: CustomFieldEntityType;
  name: string;
  field_type: CustomFieldType;
  options?: string[];
  required?: boolean;
}): Promise<ActionResult<CustomFieldDefinition>> {
  if (!VALID_ENTITY.includes(input.entity_type)) {
    return { success: false, error: "Type d'entité invalide." };
  }
  if (!VALID_FIELD_TYPE.includes(input.field_type)) {
    return { success: false, error: "Type de champ invalide." };
  }
  const name = input.name?.trim();
  if (!name) return { success: false, error: "Nom du champ requis." };
  if (input.field_type === "select" && (!input.options || input.options.length < 2)) {
    return {
      success: false,
      error: "Un champ Sélection a besoin d'au moins 2 options.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: existing } = await supabase
    .from("custom_field_definitions")
    .select("sort_order")
    .eq("entity_type", input.entity_type)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder =
    existing?.[0]?.sort_order != null ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from("custom_field_definitions")
    .insert({
      entity_type: input.entity_type,
      name,
      field_type: input.field_type,
      options: input.options?.length ? input.options : null,
      required: input.required ?? false,
      sort_order: nextOrder,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }
  revalidate(input.entity_type);
  return { success: true, data: deserializeDef(data) };
}

export async function updateFieldDefinition(
  id: string,
  input: Partial<{
    name: string;
    options: string[];
    required: boolean;
    sort_order: number;
  }>
): Promise<ActionResult> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) return { success: false, error: "Nom du champ requis." };
    patch.name = n;
  }
  if (input.options !== undefined) {
    patch.options = input.options.length ? input.options : null;
  }
  if (input.required !== undefined) patch.required = input.required;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  if (Object.keys(patch).length === 0) return { success: true, data: null };

  const { error } = await supabase
    .from("custom_field_definitions")
    .update(patch)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  for (const t of VALID_ENTITY) revalidate(t);
  return { success: true, data: null };
}

export async function deleteFieldDefinition(
  id: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("custom_field_definitions")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  for (const t of VALID_ENTITY) revalidate(t);
  return { success: true, data: null };
}

// ── Valeurs ──────────────────────────────────────────────────────────────────

export async function getFieldsWithValues(
  entityType: CustomFieldEntityType,
  entityId: string
): Promise<CustomFieldWithValue[]> {
  if (!VALID_ENTITY.includes(entityType)) return [];
  const supabase = await createClient();

  const [{ data: defs }, { data: vals }] = await Promise.all([
    supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("entity_type", entityType)
      .order("sort_order", { ascending: true }),
    supabase
      .from("custom_field_values")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId),
  ]);

  const valMap = new Map(
    (vals ?? []).map((v) => [v.field_id as string, v] as const)
  );

  return (defs ?? []).map((def) => {
    const val = valMap.get(def.id as string);
    return {
      ...deserializeDef(def),
      value: (val?.value as string | null | undefined) ?? null,
      value_id: (val?.id as string | null | undefined) ?? null,
    };
  });
}

export async function upsertFieldValue(
  fieldId: string,
  entityType: CustomFieldEntityType,
  entityId: string,
  value: string | null
): Promise<ActionResult> {
  if (!VALID_ENTITY.includes(entityType)) {
    return { success: false, error: "Type d'entité invalide." };
  }
  const supabase = await createClient();

  const trimmed = value?.trim() ?? "";
  if (trimmed === "") {
    const { error } = await supabase
      .from("custom_field_values")
      .delete()
      .eq("field_id", fieldId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("custom_field_values")
      .upsert(
        {
          field_id: fieldId,
          entity_type: entityType,
          entity_id: entityId,
          value: trimmed,
        },
        { onConflict: "field_id,entity_type,entity_id" }
      );
    if (error) return { success: false, error: error.message };
  }

  revalidate(entityType, entityId);
  return { success: true, data: null };
}
