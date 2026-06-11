import { NextRequest, NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/server";
import { signState } from "@/lib/integrations/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!(await hasPermission("integrations.connect"))) {
    return NextResponse.redirect(
      new URL("/dashboard/campagnes?error=forbidden", req.url)
    );
  }

  // `state` signé (HMAC + nonce + TTL) lié à l'utilisateur courant → protège
  // le callback contre une CSRF OAuth (injection d'un compte Gmail tiers).
  const url = getAuthUrl(signState(user.id));
  return NextResponse.redirect(url);
}
