import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilClient } from "@/components/layout/profil-client";
import type { Profile } from "@/types";

export const metadata = {
  title: "Profil · norva CRM",
};

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: teamMembers } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at");

  return (
    <>
      <pre
        style={{
          fontSize: 11,
          padding: 12,
          background: "#0b1220",
          color: "#9CA3AF",
          border: "1px solid #1F2937",
          margin: 12,
          overflowX: "auto",
        }}
      >
        {JSON.stringify(
          {
            "auth.user.id": user.id,
            "auth.user.email": user.email,
            "profile fetched": profile,
            "profile error": profileError?.message ?? null,
            "teamMembers count": teamMembers?.length ?? 0,
          },
          null,
          2
        )}
      </pre>
      <ProfilClient
        profile={profile as Profile | null}
        teamMembers={(teamMembers as Profile[] | null) ?? []}
      />
    </>
  );
}
