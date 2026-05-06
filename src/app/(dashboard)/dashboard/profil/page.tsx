import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilClient } from "@/components/layout/profil-client";
import type { Profile } from "@/types";

export const metadata = {
  title: "Profil · norva CRM",
};

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at");

  return (
    <ProfilClient
      profile={profile as Profile | null}
      teamMembers={(teamMembers as Profile[] | null) ?? []}
    />
  );
}
