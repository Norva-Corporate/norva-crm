"use server";

import { createClient } from "@/lib/supabase/server";

export interface BriefListItem {
  id: string;
  prospect_nom: string | null;
  prospect_email: string | null;
  prospect_entreprise: string | null;
  submitted_at: string;
}

export interface BriefDetail {
  id: string;
  token_id: string | null;
  prospect_nom: string | null;
  prospect_email: string | null;
  prospect_entreprise: string | null;
  reponses: Record<string, unknown>;
  submitted_at: string;
}

export interface BriefTokenItem {
  id: string;
  token: string;
  prospect_nom: string;
  prospect_email: string;
  prospect_entreprise: string | null;
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at: string | null;
}

export async function listBriefs(): Promise<BriefListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefs")
    .select(
      "id, prospect_nom, prospect_email, prospect_entreprise, submitted_at"
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("[briefs] listBriefs error:", error);
    return [];
  }
  return (data ?? []) as BriefListItem[];
}

export async function getBriefById(id: string): Promise<BriefDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefs")
    .select(
      "id, token_id, prospect_nom, prospect_email, prospect_entreprise, reponses, submitted_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[briefs] getBriefById error:", error);
    return null;
  }
  if (!data) return null;
  return {
    ...data,
    reponses: (data.reponses ?? {}) as Record<string, unknown>,
  } as BriefDetail;
}

export async function listActiveTokens(): Promise<BriefTokenItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brief_tokens")
    .select(
      "id, token, prospect_nom, prospect_email, prospect_entreprise, created_at, expires_at, used, used_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[briefs] listActiveTokens error:", error);
    return [];
  }
  return (data ?? []) as BriefTokenItem[];
}
