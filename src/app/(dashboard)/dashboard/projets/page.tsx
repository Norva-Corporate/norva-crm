import React from "react";
import { createClient } from "@/lib/supabase/server";
import { ProjetsClient } from "@/components/projets/projets-client";

export default async function ProjetsPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: deals }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          "*, deal:deals(id, title, contact:contacts(id, first_name, last_name), company:companies(id, name)), assignee:profiles(id, full_name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("deals")
        .select("id, title")
        .not("stage", "in", "(lost)")
        .order("title"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
    ]);

  return (
    <ProjetsClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialProjects={(projects ?? []) as any}
      deals={deals ?? []}
      profiles={profiles ?? []}
    />
  );
}
