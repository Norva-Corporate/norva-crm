"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/gmail";
import type { ActionResult } from "@/lib/actions/leads";

export interface EmailVariant {
  subject: string;
  body: string;
  tone: string;
}

export interface EmailCampaign {
  id: string;
  lead_id: string;
  lead_snapshot: Record<string, unknown>;
  variant_1: EmailVariant;
  variant_2: EmailVariant;
  variant_3: EmailVariant;
  selected_variant: EmailVariant | null;
  status: "pending" | "sent" | "rejected";
  created_at: string;
  sent_at: string | null;
}

export async function listPendingCampaigns(): Promise<EmailCampaign[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as EmailCampaign[]) ?? [];
}

export async function validateAndSendCampaign(
  campaignId: string,
  selectedVariant: EmailVariant
): Promise<ActionResult<null>> {
  const supabase = await createClient();

  // Get refresh token
  const { data: setting } = await supabase
    .from("prospection_settings")
    .select("value")
    .eq("key", "gmail_refresh_token")
    .single();

  if (!setting?.value) {
    return { success: false, error: "Gmail non connecté. Connecte ton compte Gmail d'abord." };
  }

  // Get campaign
  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) {
    return { success: false, error: "Campagne introuvable." };
  }

  const snapshot = campaign.lead_snapshot as Record<string, unknown>;
  const recipientEmail = snapshot.email as string;
  if (!recipientEmail) {
    return { success: false, error: "Pas d'email pour ce prospect." };
  }

  try {
    await sendEmail({
      refreshToken: setting.value,
      to: recipientEmail,
      subject: selectedVariant.subject,
      body: selectedVariant.body,
    });

    // Update campaign
    await supabase
      .from("email_campaigns")
      .update({
        status: "sent",
        selected_variant: selectedVariant,
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    // Move lead to 'contacted'
    await supabase
      .from("lead_imports")
      .update({ pipeline_stage: "contacted", stage_updated_at: new Date().toISOString() })
      .eq("id", campaign.lead_id);

    revalidatePath("/dashboard/campagnes");
    revalidatePath("/dashboard/pipeline");
    return { success: true, data: null };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function rejectCampaign(campaignId: string): Promise<ActionResult<null>> {
  const supabase = await createClient();
  await supabase
    .from("email_campaigns")
    .update({ status: "rejected" })
    .eq("id", campaignId);

  revalidatePath("/dashboard/campagnes");
  return { success: true, data: null };
}

export async function getProspectionSettings(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("prospection_settings").select("key, value");
  if (!data) return {};
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
}

export async function updateProspectionSetting(
  key: string,
  value: string
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  await supabase
    .from("prospection_settings")
    .upsert({ key, value }, { onConflict: "key" });
  revalidatePath("/dashboard/campagnes");
  return { success: true, data: null };
}
