import React from "react";
import { createClient } from "@/lib/supabase/server";
import { CompaniesClient } from "@/components/contacts/companies-client";

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .order("name");

  return <CompaniesClient initialCompanies={companies ?? []} />;
}
