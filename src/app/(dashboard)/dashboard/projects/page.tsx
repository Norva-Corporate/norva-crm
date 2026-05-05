import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ProjectsClient } from "@/components/projects/projects-client";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: deals }, { data: profiles }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, deal:deals(id, title), assignee:profiles(id, full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("deals").select("id, title").not("stage", "in", "(lost)").order("title"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  return <ProjectsClient initialProjects={projects ?? []} deals={deals ?? []} profiles={profiles ?? []} />;
}
