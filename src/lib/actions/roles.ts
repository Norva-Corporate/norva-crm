"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  assertPermission,
  PermissionDeniedError,
} from "@/lib/permissions/server";
import {
  ALL_PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions/catalog";

// ============================================================
// Types
// ============================================================
export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithStats extends Role {
  member_count: number;
  permission_keys: PermissionKey[];
}

export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================
// Helpers
// ============================================================
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function handleError(err: unknown, fallback: string): ActionResult {
  if (err instanceof PermissionDeniedError) {
    return { success: false, error: "Action réservée aux administrateurs." };
  }
  if (err instanceof Error) {
    return { success: false, error: err.message };
  }
  return { success: false, error: fallback };
}

const VALID_PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

// ============================================================
// READ
// ============================================================
export async function listRoles(): Promise<RoleWithStats[]> {
  const supabase = await createClient();

  const { data: roles, error } = await supabase
    .from("roles")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  if (error || !roles) return [];

  // Compter les membres par rôle.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("role_id");

  const counts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.role_id) {
      counts.set(p.role_id, (counts.get(p.role_id) ?? 0) + 1);
    }
  }

  // Permissions par rôle.
  const { data: perms } = await supabase
    .from("role_permissions")
    .select("role_id, permission_key");

  const permsByRole = new Map<string, PermissionKey[]>();
  for (const row of perms ?? []) {
    const list = permsByRole.get(row.role_id) ?? [];
    list.push(row.permission_key as PermissionKey);
    permsByRole.set(row.role_id, list);
  }

  return roles.map((r) => ({
    ...(r as Role),
    member_count: counts.get(r.id) ?? 0,
    permission_keys: permsByRole.get(r.id) ?? [],
  }));
}

// ============================================================
// CREATE
// ============================================================
export interface CreateRoleInput {
  name: string;
  key?: string;
  description?: string;
}

export async function createRole(
  input: CreateRoleInput
): Promise<ActionResult<{ id: string; key: string }>> {
  try {
    await assertPermission("roles.manage");

    const name = input.name?.trim();
    if (!name) return { success: false, error: "Le nom du rôle est requis." };

    const key = (input.key?.trim() || slugify(name)) || slugify(name);
    if (!key) {
      return {
        success: false,
        error: "Identifiant invalide. Utilisez des lettres et chiffres.",
      };
    }
    if (["admin", "member"].includes(key)) {
      return {
        success: false,
        error: "Cet identifiant est réservé à un rôle système.",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("roles")
      .insert({
        key,
        name,
        description: input.description?.trim() || null,
        is_system: false,
      })
      .select("id, key")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        return {
          success: false,
          error: "Un rôle avec cet identifiant existe déjà.",
        };
      }
      return { success: false, error: error?.message ?? "Création impossible." };
    }

    revalidatePath("/dashboard/settings/roles");
    revalidatePath("/dashboard/profil");
    return { success: true, data: { id: data.id, key: data.key } };
  } catch (err) {
    return handleError(err, "Création impossible.");
  }
}

// ============================================================
// UPDATE (nom + description, jamais la key)
// ============================================================
export async function updateRole(
  id: string,
  input: { name: string; description?: string }
): Promise<ActionResult> {
  try {
    await assertPermission("roles.manage");

    const name = input.name?.trim();
    if (!name) return { success: false, error: "Le nom du rôle est requis." };

    const supabase = await createClient();

    // Garde-fou : pas de rename d'un rôle système.
    const { data: existing } = await supabase
      .from("roles")
      .select("is_system")
      .eq("id", id)
      .single();
    if (!existing) {
      return { success: false, error: "Rôle introuvable." };
    }
    if (existing.is_system) {
      return {
        success: false,
        error: "Les rôles système ne peuvent pas être modifiés.",
      };
    }

    const { error } = await supabase
      .from("roles")
      .update({
        name,
        description: input.description?.trim() || null,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/settings/roles");
    revalidatePath("/dashboard/profil");
    return { success: true, data: null };
  } catch (err) {
    return handleError(err, "Mise à jour impossible.");
  }
}

// ============================================================
// DELETE
// ============================================================
export async function deleteRole(id: string): Promise<ActionResult> {
  try {
    await assertPermission("roles.manage");
    const supabase = await createClient();

    const { data: role } = await supabase
      .from("roles")
      .select("is_system, name")
      .eq("id", id)
      .single();

    if (!role) return { success: false, error: "Rôle introuvable." };
    if (role.is_system) {
      return {
        success: false,
        error: "Les rôles système ne peuvent pas être supprimés.",
      };
    }

    // Bloquer si des membres sont assignés.
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role_id", id);

    if ((count ?? 0) > 0) {
      return {
        success: false,
        error: `Impossible de supprimer : ${count} membre${
          (count ?? 0) > 1 ? "s utilisent" : " utilise"
        } ce rôle.`,
      };
    }

    const { error } = await supabase.from("roles").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/settings/roles");
    revalidatePath("/dashboard/profil");
    return { success: true, data: null };
  } catch (err) {
    return handleError(err, "Suppression impossible.");
  }
}

// ============================================================
// SET PERMISSIONS (replace all)
// ============================================================
export async function setRolePermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<ActionResult> {
  try {
    await assertPermission("roles.manage");
    const supabase = await createClient();

    const { data: role } = await supabase
      .from("roles")
      .select("key, is_system")
      .eq("id", roleId)
      .single();

    if (!role) return { success: false, error: "Rôle introuvable." };

    // Le rôle admin doit toujours conserver TOUTES les permissions.
    if (role.key === "admin") {
      return {
        success: false,
        error: "Les permissions du rôle Administrateur ne sont pas modifiables.",
      };
    }

    // Filtrer les clés invalides (typos, permissions retirées du catalogue).
    const validKeys = Array.from(
      new Set(permissionKeys.filter((k) => VALID_PERMISSION_SET.has(k)))
    );

    // Replace = delete all + insert. Idéalement en transaction (RPC), mais
    // le risque d'incohérence est faible : si le DELETE passe et l'INSERT
    // échoue, l'admin re-coche et re-save. Côté UI on revalidate après.
    const { error: delErr } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);
    if (delErr) return { success: false, error: delErr.message };

    if (validKeys.length > 0) {
      const rows = validKeys.map((permission_key) => ({
        role_id: roleId,
        permission_key,
      }));
      const { error: insErr } = await supabase
        .from("role_permissions")
        .insert(rows);
      if (insErr) return { success: false, error: insErr.message };
    }

    revalidatePath("/dashboard/settings/roles");
    revalidatePath("/dashboard", "layout");
    return { success: true, data: null };
  } catch (err) {
    return handleError(err, "Mise à jour des permissions impossible.");
  }
}

// ============================================================
// ASSIGN USER → ROLE
// ============================================================
export async function assignUserRole(
  userId: string,
  roleId: string
): Promise<ActionResult> {
  try {
    await assertPermission("users.update_role");
    const supabase = await createClient();

    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("id", roleId)
      .single();

    if (!role) return { success: false, error: "Rôle introuvable." };

    const { error } = await supabase
      .from("profiles")
      .update({ role_id: roleId })
      .eq("id", userId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/profil");
    revalidatePath("/dashboard/settings/roles");
    return { success: true, data: null };
  } catch (err) {
    return handleError(err, "Mise à jour du rôle impossible.");
  }
}
