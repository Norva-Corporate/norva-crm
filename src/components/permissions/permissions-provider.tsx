"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { PermissionKey } from "@/lib/permissions/catalog";

interface PermissionsContextValue {
  permissions: Set<PermissionKey>;
  isSystemAdmin: boolean;
  roleKey: string | null;
  userId: string | null;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export interface PermissionsProviderProps {
  children: React.ReactNode;
  permissions: PermissionKey[];
  isSystemAdmin: boolean;
  roleKey: string | null;
  userId: string | null;
}

export function PermissionsProvider({
  children,
  permissions,
  isSystemAdmin,
  roleKey,
  userId,
}: PermissionsProviderProps) {
  const value = useMemo<PermissionsContextValue>(
    () => ({
      permissions: new Set(permissions),
      isSystemAdmin,
      roleKey,
      userId,
    }),
    [permissions, isSystemAdmin, roleKey, userId]
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissionsContext(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    // Pas de provider dans l'arbre : on retombe sur "aucune permission" plutôt
    // que de throw — évite de casser un rendu de login ou une page publique.
    return { permissions: new Set(), isSystemAdmin: false, roleKey: null, userId: null };
  }
  return ctx;
}
