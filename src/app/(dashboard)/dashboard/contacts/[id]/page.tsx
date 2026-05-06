import React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getContactWithDeals } from "@/lib/actions/contacts";
import { ContactDetailClient } from "@/components/contacts/ContactDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { id } = await params;

  const contact = await getContactWithDeals(id);
  if (!contact) notFound();

  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col flex-1">
      <ContactDetailClient
        contact={contact}
        deals={contact.deals}
        companies={companies ?? []}
      />
    </div>
  );
}
