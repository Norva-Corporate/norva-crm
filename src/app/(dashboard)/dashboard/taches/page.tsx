import React from "react";
import { createClient } from "@/lib/supabase/server";
import { listTasksWithRelatedProject } from "@/lib/actions/tasks";
import { listProfilesForPicker } from "@/lib/actions/pickers";
import { TasksClient } from "@/components/tasks/tasks-client";

export default async function TachesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [tasks, members] = await Promise.all([
    listTasksWithRelatedProject(),
    listProfilesForPicker(),
  ]);

  return (
    <TasksClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialTasks={tasks as any}
      members={members}
      currentUserId={user?.id ?? null}
    />
  );
}
