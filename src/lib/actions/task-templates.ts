"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTask } from "@/lib/actions/tasks";
import { ensurePermission } from "@/lib/permissions/server";
import type { TaskPriority, TaskRelatedType } from "@/types";

// ============================================================
// task_templates — CRUD + apply
// ============================================================
// Voir migration 043_task_templates.sql. Les `items` sont stockés en
// jsonb, structure définie ici (pas de Zod en runtime pour rester
// léger — les writes passent par les server actions qui valident).
// ============================================================

export type TaskTemplateScope = "global" | "deal" | "project";

export interface TaskTemplateItem {
  title: string;
  description?: string | null;
  priority: TaskPriority;
  // Décalage en jours par rapport à la date d'application (today par défaut).
  // 0 = aujourd'hui, 3 = J+3, -1 = hier (rare mais autorisé).
  due_offset_days: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  scope: TaskTemplateScope;
  items: TaskTemplateItem[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateInput {
  name: string;
  description?: string | null;
  scope: TaskTemplateScope;
  items: TaskTemplateItem[];
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const VALID_PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];
const VALID_SCOPES: TaskTemplateScope[] = ["global", "deal", "project"];

function validateItems(items: unknown): TaskTemplateItem[] | string {
  if (!Array.isArray(items)) return "items doit être une liste.";
  const out: TaskTemplateItem[] = [];
  for (const [idx, raw] of items.entries()) {
    if (!raw || typeof raw !== "object") {
      return `Item ${idx + 1} : structure invalide.`;
    }
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim() : "";
    if (!title) return `Item ${idx + 1} : titre requis.`;
    const priority = (r.priority ?? "normal") as TaskPriority;
    if (!VALID_PRIORITIES.includes(priority)) {
      return `Item ${idx + 1} : priorité invalide.`;
    }
    const offset = Number(r.due_offset_days ?? 0);
    if (!Number.isFinite(offset)) {
      return `Item ${idx + 1} : due_offset_days doit être un nombre.`;
    }
    out.push({
      title,
      description:
        typeof r.description === "string" && r.description.trim()
          ? r.description.trim()
          : null,
      priority,
      due_offset_days: Math.trunc(offset),
    });
  }
  return out;
}

// ============================================================
// READ
// ============================================================
export async function listTaskTemplates(
  scope?: TaskTemplateScope
): Promise<TaskTemplate[]> {
  const supabase = await createClient();
  let query = supabase
    .from("task_templates")
    .select("*")
    .order("name", { ascending: true });

  // 'global' est toujours visible ; scope spécifique = filtre `in (global, scope)`.
  if (scope && scope !== "global") {
    query = query.in("scope", ["global", scope]);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("[task-templates] list:", error);
    return [];
  }
  return data as unknown as TaskTemplate[];
}

export async function getTaskTemplate(
  id: string
): Promise<TaskTemplate | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("task_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as TaskTemplate | null;
}

// ============================================================
// CREATE / UPDATE / DELETE
// ============================================================
export async function createTaskTemplate(
  input: TaskTemplateInput
): Promise<ActionResult<{ id: string }>> {
  const denied = await ensurePermission("task_templates.create");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Le nom est obligatoire." };
  if (!VALID_SCOPES.includes(input.scope)) {
    return { success: false, error: "Scope invalide." };
  }
  const items = validateItems(input.items);
  if (typeof items === "string") {
    return { success: false, error: items };
  }
  if (items.length === 0) {
    return { success: false, error: "Au moins une tâche est requise." };
  }

  const { data, error } = await supabase
    .from("task_templates")
    .insert({
      name,
      description: input.description?.trim() || null,
      scope: input.scope,
      items,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }
  revalidatePath("/dashboard/settings/task-templates");
  return { success: true, data: { id: data.id } };
}

export async function updateTaskTemplate(
  id: string,
  input: TaskTemplateInput
): Promise<ActionResult> {
  const denied = await ensurePermission("task_templates.update");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Le nom est obligatoire." };
  if (!VALID_SCOPES.includes(input.scope)) {
    return { success: false, error: "Scope invalide." };
  }
  const items = validateItems(input.items);
  if (typeof items === "string") {
    return { success: false, error: items };
  }
  if (items.length === 0) {
    return { success: false, error: "Au moins une tâche est requise." };
  }

  const { error } = await supabase
    .from("task_templates")
    .update({
      name,
      description: input.description?.trim() || null,
      scope: input.scope,
      items,
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/settings/task-templates");
  return { success: true, data: null };
}

export async function deleteTaskTemplate(id: string): Promise<ActionResult> {
  const denied = await ensurePermission("task_templates.delete");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_templates")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/settings/task-templates");
  return { success: true, data: null };
}

// ============================================================
// APPLY — créer N tâches à partir d'un template
// ============================================================
/**
 * Applique un template à un deal/projet : crée chaque item du template
 * en tant que tâche liée, avec due_date = baseDate + due_offset_days.
 *
 * - `baseDate` par défaut = aujourd'hui (00:00 local).
 * - `auto_origin` est posé à `template:<templateId>` pour tracker l'origine.
 *   (Implémentation via createTask qui ne pose pas auto_origin — on garde
 *   la valeur null pour la v1. Si besoin de tracker, étendre createTask.)
 * - `assigned_to` n'est PAS posé par défaut : chaque tâche reste non-assignée,
 *   à l'utilisateur de répartir. Possible v2 : un override `assignTo`.
 *
 * Tous les inserts se font en parallèle via Promise.all. Si un échoue,
 * on collecte l'erreur mais on n'annule pas les autres (les tâches déjà
 * créées restent — pattern de batch existant dans dismissLeadsBatch).
 */
export async function applyTaskTemplate(
  templateId: string,
  target: {
    related_type: Extract<TaskRelatedType, "deal" | "project">;
    related_id: string;
  },
  baseDate?: string
): Promise<ActionResult<{ created: number; failed: number }>> {
  const denied = await ensurePermission("task_templates.apply");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  const { data: tpl } = await supabase
    .from("task_templates")
    .select("id, items")
    .eq("id", templateId)
    .maybeSingle();
  if (!tpl) return { success: false, error: "Template introuvable." };

  const items = (tpl.items ?? []) as TaskTemplateItem[];
  if (items.length === 0) {
    return { success: false, error: "Template vide." };
  }

  // baseDate = aujourd'hui par défaut. ISO yyyy-mm-dd.
  const start = baseDate ? new Date(baseDate) : new Date();
  start.setHours(0, 0, 0, 0);

  const results = await Promise.all(
    items.map(async (it) => {
      const due = new Date(start);
      due.setDate(due.getDate() + (it.due_offset_days ?? 0));
      const due_date = due.toISOString().split("T")[0];
      return createTask({
        title: it.title,
        description: it.description ?? null,
        priority: it.priority,
        due_date,
        related_type: target.related_type,
        related_id: target.related_id,
      });
    })
  );

  let created = 0;
  let failed = 0;
  for (const r of results) {
    if (r.success) created++;
    else failed++;
  }

  return { success: true, data: { created, failed } };
}
