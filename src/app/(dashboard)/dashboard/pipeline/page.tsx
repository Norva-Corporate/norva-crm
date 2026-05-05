import React from "react";
import { createClient } from "@/lib/supabase/server";
import { PipelineClient } from "@/components/pipeline/pipeline-client";

export default async function PipelinePage() {
  const supabase = await createClient();

  const [{ data: deals }, { data: contacts }, { data: companies }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("deals")
        .select("*, contact:contacts(id, first_name, last_name), company:companies(id, name), assignee:profiles(id, full_name)")
        .order("stage_order", { ascending: true }),
      supabase.from("contacts").select("id, first_name, last_name").order("first_name"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);

  return (
    <PipelineClient
      initialDeals={deals ?? []}
      contacts={contacts ?? []}
      companies={companies ?? []}
      profiles={profiles ?? []}
    />
  );
}
