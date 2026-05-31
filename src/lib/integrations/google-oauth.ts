import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";

// ============================================================
// Service-role client (bypasses RLS — used only server-side from sync engines)
// ============================================================
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "missing supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
    );
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

// ============================================================
// Token lifecycle (refresh ~60s avant expiration)
// ============================================================
const REFRESH_THRESHOLD_MS = 60_000;

export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("missing GOOGLE_OAUTH_CLIENT_ID/SECRET");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`refresh failed (${res.status}): ${detail}`);
    (err as Error & { code?: string }).code =
      res.status === 400 || res.status === 401
        ? "invalid_grant"
        : "refresh_http";
    throw err;
  }
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
}

interface IntegrationRow {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  google_calendar_id: string | null;
  google_account_email: string | null;
}

export interface ValidGoogleToken {
  token: string;
  integrationId: string;
  calendarId: string | null;
}

/**
 * Returns a valid Google access token for the given user, refreshing
 * if needed and persisting the new token back to user_integrations.
 * Shared between Calendar and Drive — Google accepts multiple scopes
 * on the same refresh_token (cf. include_granted_scopes côté connect).
 */
export async function getValidGoogleAccessToken(
  userId: string
): Promise<ValidGoogleToken> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("user_integrations")
    .select(
      "id, user_id, access_token, refresh_token, token_expires_at, google_calendar_id, google_account_email"
    )
    .eq("user_id", userId)
    .eq("provider", "google_calendar")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("no google_calendar integration for user");

  const row = data as IntegrationRow;
  const expiresAt = new Date(row.token_expires_at).getTime();
  const stillFresh = expiresAt - Date.now() > REFRESH_THRESHOLD_MS;

  if (stillFresh) {
    return {
      token: decrypt(row.access_token),
      calendarId: row.google_calendar_id,
      integrationId: row.id,
    };
  }

  // Refresh
  const refreshToken = decrypt(row.refresh_token);
  try {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();
    await supabase
      .from("user_integrations")
      .update({
        access_token: encrypt(refreshed.access_token),
        token_expires_at: newExpiresAt,
        last_sync_error: null,
      })
      .eq("id", row.id);
    return {
      token: refreshed.access_token,
      calendarId: row.google_calendar_id,
      integrationId: row.id,
    };
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    if (code === "invalid_grant") {
      await supabase
        .from("user_integrations")
        .update({ last_sync_error: "reauth_required" })
        .eq("id", row.id);
    }
    throw err;
  }
}
