import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInvoiceWithDetails } from "@/lib/actions/invoices";
import { InvoiceDetailClient } from "@/components/facturation/InvoiceDetailClient";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoiceWithDetails(id);
  if (!invoice) notFound();

  const supabase = await createClient();

  const [{ data: projects }, { data: contacts }, { data: companies }] =
    await Promise.all([
      supabase.from("projects").select("id, name").order("name"),
      supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .order("first_name"),
      supabase.from("companies").select("id, name").order("name"),
    ]);

  return (
    <InvoiceDetailClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invoice={invoice as any}
      projects={projects ?? []}
      contacts={contacts ?? []}
      companies={companies ?? []}
    />
  );
}
