"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
} | undefined;

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message === "Invalid login credentials") {
      return { error: "Email ou mot de passe incorrect." };
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "Veuillez confirmer votre email avant de vous connecter." };
    }
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signupAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!firstName || !lastName) {
    return { error: "Prénom et nom requis." };
  }
  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }
  if (password.length < 6) {
    return { error: "Le mot de passe doit contenir au moins 6 caractères." };
  }
  if (password !== confirmPassword) {
    return { error: "Les mots de passe ne correspondent pas." };
  }

  const fullName = `${firstName} ${lastName}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, first_name: firstName, last_name: lastName },
    },
  });

  if (error) {
    if (error.message.includes("already registered") || error.message.includes("already exists")) {
      return { error: "Un compte existe déjà avec cet email." };
    }
    return { error: error.message };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return {
    message: "Compte créé. Vérifiez votre email pour confirmer votre compte.",
  };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function updateProfileAction(formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!fullName) {
    return { error: "Le nom complet est requis." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/profil");
  return { message: "Profil mis à jour." };
}

/**
 * Wrapper de compatibilité — résout la `role_key` ('admin'|'member' ou clé
 * custom) en role_id puis délègue à `assignUserRole`. Conservé pour les
 * appels existants ; nouveau code doit utiliser `assignUserRole` directement.
 */
export async function updateMemberRoleAction(
  memberId: string,
  roleKey: string
): Promise<AuthState> {
  const supabase = await createClient();
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("key", roleKey)
    .single();

  if (!role) {
    return { error: "Rôle introuvable." };
  }

  const { assignUserRole } = await import("@/lib/actions/roles");
  const result = await assignUserRole(memberId, role.id);
  if (!result.success) {
    return { error: result.error };
  }
  return { message: "Rôle mis à jour." };
}
