import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PermissionsProvider } from "@/components/permissions/permissions-provider";
import { getCurrentUserPermissions } from "@/lib/permissions/server";
import type { PermissionKey } from "@/lib/permissions/catalog";
import type { Profile } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, current] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getCurrentUserPermissions(),
  ]);

  return (
    <PermissionsProvider
      permissions={
        Array.from(current?.permissions ?? new Set<PermissionKey>())
      }
      isSystemAdmin={current?.isSystemAdmin ?? false}
      roleKey={current?.roleKey ?? null}
    >
      <DashboardShell profile={profile as Profile | null}>
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}
