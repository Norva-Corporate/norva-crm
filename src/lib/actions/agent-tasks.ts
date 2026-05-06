"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  AgentName,
  AgentTask,
  AgentTaskEntityType,
} from "@/types";

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface EnqueueInput {
  agent: AgentName;
  entity_type?: AgentTaskEntityType | null;
  entity_id?: string | null;
  context?: Record<string, unknown>;
}

const REVALIDATE_MAP: Partial<
  Record<AgentTaskEntityType, (id: string) => string[]>
> = {
  contact: (id) => [`/dashboard/contacts/${id}`],
  company: (id) => [`/dashboard/companies/${id}`],
  deal: () => ["/dashboard/pipeline"],
  project: (id) => [`/dashboard/projets/${id}`],
  lead_import: () => ["/dashboard/leads"],
};

export async function enqueueAgentTask(
  input: EnqueueInput
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié." };

  if (!input.agent) {
    return { success: false, error: "Agent requis." };
  }

  // Anti-doublon : ne pas créer une 2e tâche pending pour la même
  // entité+agent (évite les double-clics)
  if (input.entity_type && input.entity_id) {
    const { data: existing } = await supabase
      .from("agent_tasks")
      .select("id, status")
      .eq("agent", input.agent)
      .eq("entity_type", input.entity_type)
      .eq("entity_id", input.entity_id)
      .in("status", ["pending", "running"])
      .maybeSingle();
    if (existing) {
      return {
        success: false,
        error: `Une tâche est déjà ${
          existing.status === "pending" ? "en file d'attente" : "en cours"
        } pour cette entité.`,
      };
    }
  }

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent: input.agent,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      context: (input.context ?? {}) as Record<string, unknown>,
      requested_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Insertion impossible." };
  }

  if (input.entity_type && input.entity_id) {
    const fn = REVALIDATE_MAP[input.entity_type];
    if (fn) for (const path of fn(input.entity_id)) revalidatePath(path);
  }

  return { success: true, data: { id: data.id } };
}

export async function getTasksForEntity(
  entityType: AgentTaskEntityType,
  entityId: string,
  limit = 10
): Promise<AgentTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AgentTask[];
}

export async function cancelTask(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agent_tasks")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
