import React from "react";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/layout/settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at");

  return <SettingsClient profile={profile} teamMembers={teamMembers ?? []} />;
}
