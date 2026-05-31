import React from "react";
import { listContactsWithCompany } from "@/lib/actions/contacts";
import { listCompaniesForPicker } from "@/lib/actions/pickers";
import { ContactsClient } from "@/components/contacts/contacts-client";

export default async function ContactsPage() {
  const [contacts, companies] = await Promise.all([
    listContactsWithCompany(),
    listCompaniesForPicker(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <ContactsClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialContacts={contacts as any}
        companies={companies}
      />
    </div>
  );
}
