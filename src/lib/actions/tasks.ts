"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/permissions/server";
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
  const denied = await ensurePermission("tasks.create");
  if (denied) return { success: false, error: denied };

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
  const denied = await ensurePermission("tasks.update");
  if (denied) return { success: false, error: denied };

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
  const denied = await ensurePermission("tasks.update_status");
  if (denied) return { success: false, error: denied };

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
  const denied = await ensurePermission("tasks.delete");
  if (denied) return { success: false, error: denied };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  void syncEntityToAllConnectedUsers("task", id).catch((e) =>
    console.error("[gcal sync] deleteTask:", e)
  );
  revalidateTasks();
  return { success: true, data: null };
}

// ============================================================
// Tâches d'un projet (pour la fiche projet)
// ============================================================
export interface ProjectTaskRow {
  id: string;
  title: string;
  description: string | null;
  status: import("@/types").TaskStatus;
  priority: import("@/types").TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  assignee: { id: string; full_name: string | null } | null;
  auto_origin: string | null;
  created_at: string;
}

export async function getTasksForProject(
  projectId: string
): Promise<ProjectTaskRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, due_date, assigned_to, auto_origin, created_at, assignee:profiles!tasks_assigned_to_fkey(id, full_name)"
    )
    .eq("related_type", "project")
    .eq("related_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  return (data ?? []) as unknown as ProjectTaskRow[];
}

// ============================================================
// LIST — Phase D3
// ============================================================
/**
 * Liste les tâches enrichies de leur projet lié (quand related_type='project').
 * Évite la résolution N+1 au niveau de la page.
 */
export async function listTasksWithRelatedProject() {
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "*, assignee:profiles!tasks_assigned_to_fkey(id, full_name)"
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rows = tasks ?? [];
  const projectIds = Array.from(
    new Set(
      rows
        .filter((t) => t.related_type === "project" && t.related_id)
        .map((t) => t.related_id as string)
    )
  );

  let projectsMap: Record<string, string> = {};
  if (projectIds.length > 0) {
    const { data: projRows } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    projectsMap = Object.fromEntries(
      (projRows ?? []).map((p) => [p.id, p.name])
    );
  }

  return rows.map((t) => ({
    ...t,
    relatedProject:
      t.related_type === "project" && t.related_id && projectsMap[t.related_id]
        ? { id: t.related_id as string, name: projectsMap[t.related_id] }
        : null,
  }));
}
