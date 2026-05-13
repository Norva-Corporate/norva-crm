import { NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { jsonWithCors, preflight } from "@/lib/cors";
import { sendBriefNotificationEmail } from "@/lib/briefs/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().trim().min(1),
  reponses: z.record(z.string(), z.unknown()),
});

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonWithCors(req, { error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonWithCors(
      req,
      { error: "Validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Lecture du token pour récupérer les infos prospect + liens CRM
  // (snapshot dans briefs pour conservation historique).
  const { data: tokenRow, error: readErr } = await service
    .from("brief_tokens")
    .select(
      "id, prospect_nom, prospect_email, prospect_entreprise, contact_id, company_id, expires_at, used, archived_at"
    )
    .eq("token", parsed.data.token)
    .maybeSingle();

  if (readErr) {
    return jsonWithCors(req, { error: "Erreur serveur" }, { status: 500 });
  }
  if (!tokenRow || tokenRow.archived_at) {
    return jsonWithCors(req, { error: "Token introuvable" }, { status: 404 });
  }
  if (tokenRow.used) {
    return jsonWithCors(req, { error: "Token déjà utilisé" }, { status: 409 });
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return jsonWithCors(req, { error: "Token expiré" }, { status: 410 });
  }

  // Update atomique : consommer le token seulement s'il n'est pas déjà used.
  // Si 0 ligne affectée → concurrence détectée → 409.
  const { data: consumed, error: consumeErr } = await service
    .from("brief_tokens")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", tokenRow.id)
    .eq("used", false)
    .select("id");

  if (consumeErr) {
    return jsonWithCors(req, { error: consumeErr.message }, { status: 500 });
  }
  if (!consumed || consumed.length === 0) {
    return jsonWithCors(req, { error: "Token déjà utilisé" }, { status: 409 });
  }

  const { data: brief, error: insertErr } = await service
    .from("briefs")
    .insert({
      token_id: tokenRow.id,
      prospect_nom: tokenRow.prospect_nom,
      prospect_email: tokenRow.prospect_email,
      prospect_entreprise: tokenRow.prospect_entreprise,
      contact_id: tokenRow.contact_id,
      company_id: tokenRow.company_id,
      reponses: parsed.data.reponses,
    })
    .select("id")
    .single();

  if (insertErr || !brief) {
    // Rollback best-effort : remettre le token en used=false (le brief n'a pas été inséré)
    await service
      .from("brief_tokens")
      .update({ used: false, used_at: null })
      .eq("id", tokenRow.id);
    return jsonWithCors(
      req,
      { error: insertErr?.message ?? "Échec enregistrement brief" },
      { status: 500 }
    );
  }

  // Notification email (fire-and-forget, ne fait pas échouer la soumission)
  await sendBriefNotificationEmail({
    briefId: brief.id,
    prospect_nom: tokenRow.prospect_nom,
    prospect_email: tokenRow.prospect_email,
    prospect_entreprise: tokenRow.prospect_entreprise,
    reponses: parsed.data.reponses,
  }).catch((e) => {
    console.error("[briefs/submit] notification email error:", e);
  });

  return jsonWithCors(req, { success: true, brief_id: brief.id });
}
