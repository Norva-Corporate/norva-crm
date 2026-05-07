"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncEntityToAllConnectedUsers } from "@/lib/integrations/google-calendar";
import type {
  TaskPriority,
  TaskRelatedType,
  TaskStatus,
} from "@/types";

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  related_type?: TaskRelatedType | null;
  related_id?: string | null;
  assigned_to?: string | null;
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

const VALID_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "done",
  "cancelled",
];
const VALID_PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];

function nullify<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k in obj) {
    const v = obj[k];
    out[k] = (v === "" || v === undefined ? null : v) as T[Extract<
      keyof T,
      string
    >];
  }
  return out;
}

function revalidateTasks(relatedType?: string | null, relatedId?: string | null) {
  revalidatePath("/dashboard/taches");
  revalidatePath("/dashboard");
  if (relatedType && relatedId) {
    const map: Record<string, string> = {
      contact: "/dashboard/contacts/",
      company: "/dashboard/companies/",
      deal: "/dashboard/pipeline",
      project: "/dashboard/projets/",
    };
    const base = map[relatedType];
    if (base) {
      revalidatePath(base + (relatedType === "deal" ? "" : relatedId));
    }
  }
}

export async function createTask(
  data: TaskInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  if (!data.title?.trim()) {
    return { success: false, error: "Le titre est obligatoire." };
  }
  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return { success: false, error: "Statut invalide." };
  }
  if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
    return { success: false, error: "Priorité invalide." };
  }

  const payload = nullify({
    title: data.title.trim(),
    description: data.description,
    status: data.status ?? "pending",
    priority: data.priority ?? "normal",
    due_date: data.due_date,
    related_type: data.related_type,
    related_id: data.related_id,
    assigned_to: data.assigned_to,
  });

  const { data: inserted, error } = await supabase
    .from("tasks")
    .insert({ ...payload, created_by: user.id })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Création impossible." };
  }

  void syncEntityToAllConnectedUsers("task", inserted.id).catch((e) =>
    console.error("[gcal sync] createTask:", e)
  );
  revalidateTasks(data.related_type, data.related_id);
  return { success: true, data: { id: inserted.id } };
}

export async function updateTask(
  id: string,
  data: TaskInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!data.title?.trim()) {
    return { success: false, error: "Le titre est obligatoire." };
  }
  if (data.status && !VALID_STATUSES.includes(data.status)) {
    return { success: false, error: "Statut invalide." };
  }
  if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
    return { success: false, error: "Priorité invalide." };
  }

  const payload = nullify({
    title: data.title.trim(),
    description: data.description,
    status: data.status,
    priority: data.priority,
    due_date: data.due_date,
    related_type: data.related_type,
    related_id: data.related_id,
    assigned_to: data.assigned_to,
  });

  const { error } = await supabase.from("tasks").update(payload).eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("task", id).catch((e) =>
    console.error("[gcal sync] updateTask:", e)
  );
  revalidateTasks(data.related_type, data.related_id);
  return { success: true, data: null };
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus
): Promise<ActionResult> {
  if (!VALID_STATUSES.includes(status)) {
    return { success: false, error: "Statut invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("task", id).catch((e) =>
    console.error("[gcal sync] updateTaskStatus:", e)
  );
  revalidateTasks();
  return { success: true, data: null };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("task", id).catch((e) =>
    console.error("[gcal sync] deleteTask:", e)
  );
  revalidateTasks();
  return { success: true, data: null };
}
