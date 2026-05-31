import React from "react";
import { listInvoicesWithRelations } from "@/lib/actions/invoices";
import {
  listCompaniesForPicker,
  listContactsForPicker,
  listProjectsForPicker,
} from "@/lib/actions/pickers";
import { FacturationClient } from "@/components/facturation/facturation-client";

export default async function FacturationPage() {
  const [invoices, projects, contacts, companies] = await Promise.all([
    listInvoicesWithRelations(),
    listProjectsForPicker(),
    listContactsForPicker(),
    listCompaniesForPicker(),
  ]);

  return (
    <FacturationClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialInvoices={invoices as any}
      projects={projects}
      contacts={contacts}
      companies={companies}
    />
  );
}
