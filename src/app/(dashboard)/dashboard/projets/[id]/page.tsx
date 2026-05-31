import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectWithDetails } from "@/lib/actions/projects";
import { getTasksForProject } from "@/lib/actions/tasks";
import { getActivitiesForEntity } from "@/lib/actions/activities";
import { getTagsForEntity } from "@/lib/actions/tags";
import { ProjectDetailClient } from "@/components/projets/ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectWithDetails(id);
  if (!project) notFound();

  const supabase = await createClient();

  const [
    { data: deals },
    { data: profiles },
    { data: projects },
    { data: contacts },
    { data: companies },
    activities,
    tags,
    projectTasks,
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("id, title")
      .not("stage", "in", "(lost)")
      .order("title"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("contacts")
      .select("id, first_name, last_name")
      .order("first_name"),
    supabase.from("companies").select("id, name").order("name"),
    getActivitiesForEntity("project", id),
    getTagsForEntity("project", id),
    getTasksForProject(id),
  ]);

  return (
    <ProjectDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      project={project as any}
      deals={deals ?? []}
      profiles={profiles ?? []}
      projects={projects ?? []}
      contacts={contacts ?? []}
      companies={companies ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activities={activities as any}
      tags={tags}
      tasks={projectTasks}
    />
  );
}
