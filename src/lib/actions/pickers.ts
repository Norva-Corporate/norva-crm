"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// Phase D3 — Picker helpers partagés
// ============================================================
// Toutes les pages qui affichent un Select (contact / company /
// project / deal / profil) tirent leur liste depuis ici, au lieu
// d'inliner `.from(...).select(...)` dans chaque page server.
//
// Shape minimaliste — si une page a besoin d'un attribut en plus,
// ajouter une variante explicite plutôt que de gonfler le shape commun.
// ============================================================

export interface ContactPickerItem {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  company_id?: string | null;
}

export async function listContactsForPicker(): Promise<ContactPickerItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, company_id")
    .order("first_name", { ascending: true });
  if (error) {
    console.error("[pickers] listContactsForPicker:", error);
    return [];
  }
  return (data ?? []) as ContactPickerItem[];
}

export interface CompanyPickerItem {
  id: string;
  name: string;
}

export async function listCompaniesForPicker(): Promise<CompanyPickerItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    console.error("[pickers] listCompaniesForPicker:", error);
    return [];
  }
  return (data ?? []) as CompanyPickerItem[];
}

export interface ProfilePickerItem {
  id: string;
  full_name: string | null;
  email: string | null;
}

export async function listProfilesForPicker(): Promise<ProfilePickerItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("full_name", { ascending: true });
  if (error) {
    console.error("[pickers] listProfilesForPicker:", error);
    return [];
  }
  return (data ?? []) as ProfilePickerItem[];
}

export interface ProjectPickerItem {
  id: string;
  name: string;
}

export async function listProjectsForPicker(): Promise<ProjectPickerItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) {
    console.error("[pickers] listProjectsForPicker:", error);
    return [];
  }
  return (data ?? []) as ProjectPickerItem[];
}

export interface DealPickerItem {
  id: string;
  title: string;
}

/** Deals "ouverts" — sert au Select dans Project / Invoice / etc. */
export async function listOpenDealsForPicker(): Promise<DealPickerItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("id, title")
    .not("stage", "in", "(lost)")
    .order("title", { ascending: true });
  if (error) {
    console.error("[pickers] listOpenDealsForPicker:", error);
    return [];
  }
  return (data ?? []) as DealPickerItem[];
}
