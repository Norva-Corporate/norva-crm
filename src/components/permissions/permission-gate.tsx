"use client";

import React from "react";
import { usePermission } from "@/hooks/use-permission";
import type { PermissionKey } from "@/lib/permissions/catalog";

interface Props {
  /** Permission requise. Si absente, on rend `fallback` (ou rien). */
  require: PermissionKey;
  children: React.ReactNode;
  /** Élément alternatif à afficher si la permission n'est pas accordée. */
  fallback?: React.ReactNode;
}

/**
 * Masque les enfants si l'utilisateur n'a pas la permission `require`.
 *
 * Usage :
 *   <PermissionGate require="deals.delete">
 *     <Button onClick={handleDelete}>Supprimer</Button>
 *   </PermissionGate>
 *
 * Note : c'est une UI gate, pas un check de sécurité. Toujours dupliquer
 * `assertPermission()` côté Server Action — la source de vérité reste
 * Supabase RLS + le helper serveur.
 */
export function PermissionGate({ require, children, fallback = null }: Props) {
  const allowed = usePermission(require);
  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
