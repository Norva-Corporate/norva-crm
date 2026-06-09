import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "./catalog";

// ============================================================
// Récupération des permissions de l'utilisateur courant
// ============================================================
// Mise en cache par render (React.cache) : un seul SELECT par request, même
// si plusieurs Server Actions / pages le demandent.
// ============================================================

export interface CurrentUserPermissions {
  userId: string;
  roleId: string | null;
  roleKey: string | null;        // 'admin', 'member', ou clé custom
  isSystemAdmin: boolean;
  permissions: Set<PermissionKey>;
}

export const getCurrentUserPermissions = cache(
  async (): Promise<CurrentUserPermissions | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // 1) profile + role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, role_id, roles:role_id (key)")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return {
        userId: user.id,
        roleId: null,
        roleKey: null,
        isSystemAdmin: false,
        permissions: new Set(),
      };
    }

    // Le join Supabase renvoie soit un objet, soit null. Le type généré
    // peut être un tableau selon les versions — on lit safe.
    const roleRel = (profile as { roles?: { key?: string } | { key?: string }[] }).roles;
    const roleKey = Array.isArray(roleRel)
      ? roleRel[0]?.key ?? null
      : roleRel?.key ?? null;
    const legacyRole = (profile as { role?: string }).role;
    const effectiveRoleKey = roleKey ?? legacyRole ?? null;
    const isSystemAdmin = effectiveRoleKey === "admin";

    // 2) permissions (depuis role_permissions)
    const permissions = new Set<PermissionKey>();

    if (profile.role_id) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", profile.role_id);

      for (const row of perms ?? []) {
        permissions.add(row.permission_key as PermissionKey);
      }
    } else if (isSystemAdmin) {
      // Fallback legacy : profil admin sans role_id (race en signup avant 047).
      // On considère qu'il a toutes les permissions — la matrice exhaustive
      // sera réconciliée à la prochaine connexion.
      const { ALL_PERMISSIONS } = await import("./catalog");
      for (const p of ALL_PERMISSIONS) permissions.add(p);
    }

    return {
      userId: user.id,
      roleId: profile.role_id ?? null,
      roleKey: effectiveRoleKey,
      isSystemAdmin,
      permissions,
    };
  }
);

// ============================================================
// Helpers d'enforcement côté Server Actions
// ============================================================

export class PermissionDeniedError extends Error {
  readonly permission: PermissionKey;
  constructor(permission: PermissionKey) {
    super(`Permission refusée : ${permission}`);
    this.permission = permission;
    this.name = "PermissionDeniedError";
  }
}

/**
 * Throw `PermissionDeniedError` si l'utilisateur courant ne possède pas
 * la permission demandée. À appeler en première ligne de chaque Server
 * Action sensible. Retourne `{ userId, isSystemAdmin }` pour usage downstream.
 */
export async function assertPermission(
  permission: PermissionKey
): Promise<{ userId: string; isSystemAdmin: boolean }> {
  const current = await getCurrentUserPermissions();
  if (!current) {
    throw new PermissionDeniedError(permission);
  }
  if (current.isSystemAdmin) {
    return { userId: current.userId, isSystemAdmin: true };
  }
  if (!current.permissions.has(permission)) {
    throw new PermissionDeniedError(permission);
  }
  return { userId: current.userId, isSystemAdmin: false };
}

/**
 * Version souple : retourne `false` au lieu de throw. Pratique pour des
 * conditions "afficher OU pas" côté Server Component.
 */
export async function hasPermission(permission: PermissionKey): Promise<boolean> {
  const current = await getCurrentUserPermissions();
  if (!current) return false;
  if (current.isSystemAdmin) return true;
  return current.permissions.has(permission);
}
