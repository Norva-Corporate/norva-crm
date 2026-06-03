import React from "react";
import { createClient } from "@/lib/supabase/server";
import { PipelineClient } from "@/components/pipeline/PipelineClient";
import { listLeads, listProfilesLight } from "@/lib/actions/leads";
import type { DealWithRelations } from "@/types";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const supabase = await createClient();

  const [
    { data: deals },
    { data: contacts },
    { data: companies },
    { data: profiles },
    leads,
    leadProfiles,
  ] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "*, contact:contacts(id, first_name, last_name), company:companies(id, name), assignee:profiles!deals_assigned_to_fkey(id, full_name, email, avatar_url, role, created_at, updated_at)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, first_name, last_name, company_id")
      .order("first_name", { ascending: true }),
    supabase
      .from("companies")
      .select("id, name")
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true }),
    listLeads(),
    listProfilesLight(),
  ]);

  return (
    <PipelineClient
      initialDeals={(deals ?? []) as unknown as DealWithRelations[]}
      initialLeads={leads}
      contacts={contacts ?? []}
      companies={companies ?? []}
      profiles={profiles ?? []}
      leadProfiles={leadProfiles}
    />
  );
}
