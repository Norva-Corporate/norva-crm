import React from "react";
import { notFound } from "next/navigation";
import { getProjectWithDetails } from "@/lib/actions/projects";
import { getTasksForProject } from "@/lib/actions/tasks";
import { getActivitiesForEntity } from "@/lib/actions/activities";
import { getTagsForEntity } from "@/lib/actions/tags";
import {
  listCompaniesForPicker,
  listContactsForPicker,
  listOpenDealsForPicker,
  listProfilesForPicker,
  listProjectsForPicker,
} from "@/lib/actions/pickers";
import { ProjectDetailClient } from "@/components/projets/ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProjectWithDetails(id);
  if (!project) notFound();

  const [
    deals,
    profiles,
    projects,
    contacts,
    companies,
    activities,
    tags,
    projectTasks,
  ] = await Promise.all([
    listOpenDealsForPicker(),
    listProfilesForPicker(),
    listProjectsForPicker(),
    listContactsForPicker(),
    listCompaniesForPicker(),
    getActivitiesForEntity("project", id),
    getTagsForEntity("project", id),
    getTasksForProject(id),
  ]);

  return (
    <ProjectDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      project={project as any}
      deals={deals}
      profiles={profiles}
      projects={projects}
      contacts={contacts}
      companies={companies}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      activities={activities as any}
      tags={tags}
      tasks={projectTasks}
    />
  );
}
