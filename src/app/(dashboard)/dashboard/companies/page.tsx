import React from "react";
import { createClient } from "@/lib/supabase/server";
import { CompaniesClient } from "@/components/contacts/companies-client";
import type { Company } from "@/types";

type CompanyWithCount = Company & {
  contacts: { count: number }[] | null;
};

export default async function CompaniesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("companies")
    .select("*, contacts(count)")
    .order("name");

  const companies = ((data ?? []) as CompanyWithCount[]).map((c) => {
    const { contacts, ...rest } = c;
    return {
      ...rest,
      contacts_count: contacts?.[0]?.count ?? 0,
    };
  });

  return (
    <div className="flex flex-col flex-1">
      <CompaniesClient initialCompanies={companies} />
    </div>
  );
}
