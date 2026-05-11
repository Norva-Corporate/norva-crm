import React from "react";
import { createClient } from "@/lib/supabase/server";
import { TasksClient } from "@/components/tasks/tasks-client";

export default async function TachesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: tasks }, { data: members }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "*, assignee:profiles!tasks_assigned_to_fkey(id, full_name)"
      )
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name"),
  ]);

  // Résoudre les noms des projets liés aux tâches (related_type='project')
  const projectIds = Array.from(
    new Set(
      (tasks ?? [])
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

  // Enrichir chaque tâche avec son projet lié (pour styling + filtre)
  const enrichedTasks = (tasks ?? []).map((t) => ({
    ...t,
    relatedProject:
      t.related_type === "project" && t.related_id && projectsMap[t.related_id]
        ? { id: t.related_id as string, name: projectsMap[t.related_id] }
        : null,
  }));

  return (
    <TasksClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialTasks={enrichedTasks as any}
      members={members ?? []}
      currentUserId={user?.id ?? null}
    />
  );
}
