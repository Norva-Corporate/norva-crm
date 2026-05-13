import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { jsonWithCors, preflight } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return jsonWithCors(req, { valid: false, reason: "not_found" });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("brief_tokens")
    .select("prospect_nom, prospect_entreprise, expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return jsonWithCors(
      req,
      { valid: false, reason: "error" },
      { status: 500 }
    );
  }
  if (!data) {
    return jsonWithCors(req, { valid: false, reason: "not_found" });
  }
  if (data.used) {
    return jsonWithCors(req, { valid: false, reason: "used" });
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return jsonWithCors(req, { valid: false, reason: "expired" });
  }

  return jsonWithCors(req, {
    valid: true,
    prospect_nom: data.prospect_nom,
    prospect_entreprise: data.prospect_entreprise,
  });
}
