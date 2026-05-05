import React from "react";
import { createClient } from "@/lib/supabase/server";
import { BillingClient } from "@/components/billing/billing-client";

export default async function BillingPage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: projects }, { data: contacts }, { data: companies }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("*, project:projects(id, name), contact:contacts(id, first_name, last_name), company:companies(id, name)")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("contacts").select("id, first_name, last_name").order("first_name"),
      supabase.from("companies").select("id, name").order("name"),
    ]);

  return (
    <BillingClient
      initialInvoices={invoices ?? []}
      projects={projects ?? []}
      contacts={contacts ?? []}
      companies={companies ?? []}
    />
  );
}
