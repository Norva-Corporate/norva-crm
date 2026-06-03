import React from "react";
import { notFound } from "next/navigation";
import { getContactWithDeals } from "@/lib/actions/contacts";
import { getActivitiesForEntity } from "@/lib/actions/activities";
import { getTagsForEntity } from "@/lib/actions/tags";
import { getTasksForEntity } from "@/lib/actions/agent-tasks";
import { listCompaniesForPicker } from "@/lib/actions/pickers";
import { ContactDetailClient } from "@/components/contacts/ContactDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params;

  const contact = await getContactWithDeals(id);
  if (!contact) notFound();

  const [companies, activities, tags, agentTasks] = await Promise.all([
    listCompaniesForPicker(),
    getActivitiesForEntity("contact", id),
    getTagsForEntity("contact", id),
    getTasksForEntity("contact", id),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <ContactDetailClient
        contact={contact}
        deals={contact.deals}
        companies={companies}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activities={activities as any}
        tags={tags}
        agentTasks={agentTasks}
      />
    </div>
  );
}
