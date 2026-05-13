import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prospect_nom: z.string().trim().min(1, "Nom requis").max(200),
  prospect_email: z.string().trim().email("Email invalide").max(200),
  prospect_entreprise: z.string().trim().max(200).optional().nullable(),
  expires_in_hours: z.number().int().min(1).max(168).optional(),
});

export async function POST(req: NextRequest) {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const hours = parsed.data.expires_in_hours ?? 72;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const token = crypto.randomUUID();

  const service = createServiceClient();
  const { data, error } = await service
    .from("brief_tokens")
    .insert({
      token,
      prospect_nom: parsed.data.prospect_nom,
      prospect_email: parsed.data.prospect_email,
      prospect_entreprise: parsed.data.prospect_entreprise ?? null,
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
    })
    .select("id, token, expires_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Échec création token" },
      { status: 500 }
    );
  }

  const base = process.env.VITRINE_BASE_URL ?? "https://norva-corporate.fr";
  const url = `${base.replace(/\/$/, "")}/brief?token=${encodeURIComponent(
    data.token
  )}`;

  return NextResponse.json({
    id: data.id,
    token: data.token,
    url,
    expires_at: data.expires_at,
  });
}
