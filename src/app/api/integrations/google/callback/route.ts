import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { createClient } from "@/lib/supabase/server";
import { encrypt, verifyState } from "@/lib/integrations/crypto";
import { getServiceClient, ensureCalendar } from "@/lib/integrations/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWithStatus(req: NextRequest, status: string) {
  const url = new URL("/dashboard/integrations", req.url);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");
  if (errParam) return redirectWithStatus(req, `denied:${errParam}`);
  if (!code || !state) return redirectWithStatus(req, "missing_code");

  let payload;
  try {
    payload = verifyState(state);
  } catch {
    return redirectWithStatus(req, "invalid_state");
  }
  if (payload.userId !== user.id) {
    return redirectWithStatus(req, "user_mismatch");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithStatus(req, "env_missing");
  }

  const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  let tokens;
  try {
    const exch = await client.getToken(code);
    tokens = exch.tokens;
  } catch (err) {
    console.error("[gcal/callback] getToken failed:", err);
    return redirectWithStatus(req, "exchange_failed");
  }

  const accessToken = tokens.access_token;
  const refreshToken = tokens.refresh_token;
  const expiryDate = tokens.expiry_date;
  const scope = tokens.scope ?? "";
  if (!accessToken || !refreshToken || !expiryDate) {
    return redirectWithStatus(req, "missing_tokens");
  }

  // Fetch the connecting account email for display
  let accountEmail: string | null = null;
  try {
    const userinfoRes = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    if (userinfoRes.ok) {
      const info = (await userinfoRes.json()) as { email?: string };
      accountEmail = info.email ?? null;
    }
  } catch {
    /* non-blocking */
  }

  // Upsert integration row via service role (RLS denies INSERT for the user role)
  const service = getServiceClient();
  const { error: upsertErr } = await service.from("user_integrations").upsert(
    {
      user_id: user.id,
      provider: "google_calendar",
      access_token: encrypt(accessToken),
      refresh_token: encrypt(refreshToken),
      token_expires_at: new Date(expiryDate).toISOString(),
      scope,
      google_account_email: accountEmail,
      last_sync_error: null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );
  if (upsertErr) {
    console.error("[gcal/callback] upsert failed:", upsertErr);
    return redirectWithStatus(req, "db_upsert_failed");
  }

  // Bootstrap the dedicated "Norva CRM" calendar
  try {
    await ensureCalendar(user.id);
  } catch (err) {
    console.error("[gcal/callback] ensureCalendar failed:", err);
    return redirectWithStatus(req, "calendar_create_failed");
  }

  return redirectWithStatus(req, "connected");
}
