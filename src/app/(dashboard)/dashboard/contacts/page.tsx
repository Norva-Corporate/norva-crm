import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ContactsClient } from "@/components/contacts/contacts-client";

export default async function ContactsPage() {
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*, company:companies(id, name)")
    .order("created_at", { ascending: false });

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col flex-1">
      <ContactsClient
        initialContacts={contacts ?? []}
        companies={companies ?? []}
      />
    </div>
  );
}
