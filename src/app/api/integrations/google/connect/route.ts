import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createClient } from "@/lib/supabase/server";
import { signState } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  // drive.file = accès uniquement aux fichiers/dossiers créés par l'app
  // (pas d'accès au reste du Drive de l'utilisateur). Suffisant pour
  // l'auto-création de dossier deal/projet (Phase C, 039).
  "https://www.googleapis.com/auth/drive.file",
];

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", _req.url));
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: "Google OAuth env vars missing" },
      { status: 500 }
    );
  }

  const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: signState(user.id),
    include_granted_scopes: true,
  });

  return NextResponse.redirect(url);
}
