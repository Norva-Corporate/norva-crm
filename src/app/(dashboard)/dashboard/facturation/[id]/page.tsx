import React from "react";
import { notFound } from "next/navigation";
import { getInvoiceWithDetails } from "@/lib/actions/invoices";
import {
  listCompaniesForPicker,
  listContactsForPicker,
  listProjectsForPicker,
} from "@/lib/actions/pickers";
import { InvoiceDetailClient } from "@/components/facturation/InvoiceDetailClient";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceWithDetails(id);
  if (!invoice) notFound();

  const [projects, contacts, companies] = await Promise.all([
    listProjectsForPicker(),
    listContactsForPicker(),
    listCompaniesForPicker(),
  ]);

  return (
    <InvoiceDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoice={invoice as any}
      projects={projects}
      contacts={contacts}
      companies={companies}
    />
  );
}
