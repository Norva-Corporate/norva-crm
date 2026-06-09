import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilClient } from "@/components/layout/profil-client";
import { listRoles } from "@/lib/actions/roles";
import { hasPermission } from "@/lib/permissions/server";
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
    .select("id, email, full_name, role, role_id, created_at")
    .order("created_at");

  // Rôles disponibles pour le Select (admin only — on évite l'appel si non admin)
  const canManageUsers = await hasPermission("users.update_role");
  const roles = canManageUsers ? await listRoles() : [];

  return (
    <ProfilClient
      profile={profile as Profile | null}
      teamMembers={(teamMembers as TeamMember[] | null) ?? []}
      availableRoles={roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        is_system: r.is_system,
      }))}
      canManageRoles={await hasPermission("roles.manage")}
    />
  );
}

type TeamMember = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "member";
  role_id: string | null;
  created_at: string;
};
