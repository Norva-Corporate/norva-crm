import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/server";
import { verifyState, encrypt } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard/campagnes?error=no_code", req.url)
    );
  }

  // Auth (défense en profondeur — le middleware gate déjà /api/auth/gmail/*).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // CSRF : le state doit être signé par nous ET lié à l'utilisateur courant.
  try {
    if (!state) throw new Error("missing state");
    const payload = verifyState(state);
    if (payload.userId !== user.id) throw new Error("state user mismatch");
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/campagnes?error=invalid_state", req.url)
    );
  }

  try {
    const tokens = await getTokensFromCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL("/dashboard/campagnes?error=no_refresh_token", req.url)
      );
    }

    // Chiffré au repos (AES-256-GCM). prospection_settings est lisible par tout
    // authentifié → le refresh token ne doit jamais y être stocké en clair.
    await supabase
      .from("prospection_settings")
      .upsert(
        { key: "gmail_refresh_token", value: encrypt(tokens.refresh_token) },
        { onConflict: "key" }
      );

    return NextResponse.redirect(
      new URL("/dashboard/campagnes?connected=1", req.url)
    );
  } catch {
    return NextResponse.redirect(
      new URL("/dashboard/campagnes?error=oauth_failed", req.url)
    );
  }
}
