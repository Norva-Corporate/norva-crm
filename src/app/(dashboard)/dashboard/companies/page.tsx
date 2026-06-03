import React from "react";
import { listCompaniesWithContactCount } from "@/lib/actions/contacts";
import { CompaniesClient } from "@/components/contacts/companies-client";

export default async function CompaniesPage() {
  const companies = await listCompaniesWithContactCount();

  return (
    <div className="flex flex-col flex-1">
      <CompaniesClient initialCompanies={companies} />
    </div>
  );
}
