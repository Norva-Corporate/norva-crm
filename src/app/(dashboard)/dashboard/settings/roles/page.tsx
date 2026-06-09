import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/server";
import { listRoles } from "@/lib/actions/roles";
import { RolesClient } from "@/components/settings/roles-client";

export const metadata = {
  title: "Rôles & permissions · norva CRM",
};

export const dynamic = "force-dynamic";

export default async function RolesSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await hasPermission("roles.manage"))) {
    redirect("/dashboard/profil");
  }

  const roles = await listRoles();
  return <RolesClient initialRoles={roles} />;
}
