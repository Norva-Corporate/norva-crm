"use client";

import { usePermissionsContext } from "@/components/permissions/permissions-provider";
import type { PermissionKey } from "@/lib/permissions/catalog";

/**
 * Retourne `true` si l'utilisateur courant possède la permission demandée.
 * Les admins système ont toujours toutes les permissions.
 */
export function usePermission(permission: PermissionKey): boolean {
  const { permissions, isSystemAdmin } = usePermissionsContext();
  if (isSystemAdmin) return true;
  return permissions.has(permission);
}

/** Au moins UNE des permissions de la liste. */
export function useHasAnyPermission(perms: PermissionKey[]): boolean {
  const { permissions, isSystemAdmin } = usePermissionsContext();
  if (isSystemAdmin) return true;
  return perms.some((p) => permissions.has(p));
}

/** TOUTES les permissions de la liste. */
export function useHasAllPermissions(perms: PermissionKey[]): boolean {
  const { permissions, isSystemAdmin } = usePermissionsContext();
  if (isSystemAdmin) return true;
  return perms.every((p) => permissions.has(p));
}

/** Le rôle système (admin) — utile pour la rétro-compat avec `profile.role`. */
export function useIsSystemAdmin(): boolean {
  return usePermissionsContext().isSystemAdmin;
}

/** L'id de l'utilisateur courant (depuis le contexte permissions). */
export function useCurrentUserId(): string | null {
  return usePermissionsContext().userId;
}
