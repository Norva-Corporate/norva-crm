import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/gmail";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/dashboard/campagnes?error=no_code", req.url));
  }

  try {
    const tokens = await getTokensFromCode(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/dashboard/campagnes?error=no_refresh_token", req.url));
    }

    const supabase = await createClient();
    await supabase
      .from("prospection_settings")
      .upsert({ key: "gmail_refresh_token", value: tokens.refresh_token }, { onConflict: "key" });

    return NextResponse.redirect(new URL("/dashboard/campagnes?connected=1", req.url));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/campagnes?error=oauth_failed", req.url));
  }
}
