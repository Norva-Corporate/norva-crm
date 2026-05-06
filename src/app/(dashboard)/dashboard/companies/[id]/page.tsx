import React from "react";
import { notFound } from "next/navigation";
import { getCompanyWithContactsAndDeals } from "@/lib/actions/contacts";
import { CompanyDetailClient } from "@/components/contacts/CompanyDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { id } = await params;

  const company = await getCompanyWithContactsAndDeals(id);
  if (!company) notFound();

  const { contacts, deals, ...companyData } = company;

  return (
    <div className="flex flex-col flex-1">
      <CompanyDetailClient
        company={companyData}
        contacts={contacts}
        deals={deals}
      />
    </div>
  );
}
