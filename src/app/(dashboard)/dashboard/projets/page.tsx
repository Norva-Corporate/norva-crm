import React from "react";
import { listProjectsWithRelations } from "@/lib/actions/projects";
import {
  listCompaniesForPicker,
  listContactsForPicker,
  listOpenDealsForPicker,
  listProfilesForPicker,
} from "@/lib/actions/pickers";
import { ProjetsClient } from "@/components/projets/projets-client";

export default async function ProjetsPage() {
  const [projects, deals, profiles, contacts, companies] = await Promise.all([
    listProjectsWithRelations(),
    listOpenDealsForPicker(),
    listProfilesForPicker(),
    listContactsForPicker(),
    listCompaniesForPicker(),
  ]);

  return (
    <ProjetsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialProjects={projects as any}
      deals={deals}
      profiles={profiles}
      contacts={contacts}
      companies={companies}
    />
  );
}
