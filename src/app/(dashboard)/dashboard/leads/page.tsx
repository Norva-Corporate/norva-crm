import React from "react";
import { createClient } from "@/lib/supabase/server";
import { listLeads, listProfilesLight } from "@/lib/actions/leads";
import { LeadsClient } from "@/components/leads/leads-client";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = await createClient();
  const [leads, { data: companies }, profiles] = await Promise.all([
    listLeads(),
    supabase.from("companies").select("id, name").order("name"),
    listProfilesLight(),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <LeadsClient
        leads={leads}
        companies={companies ?? []}
        profiles={profiles}
      />
    </div>
  );
}
