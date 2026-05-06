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

  return (
    <TasksClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialTasks={(tasks ?? []) as any}
      members={members ?? []}
      currentUserId={user?.id ?? null}
    />
  );
}
