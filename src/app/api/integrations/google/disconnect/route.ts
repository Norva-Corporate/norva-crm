import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/integrations/crypto";
import { getServiceClient } from "@/lib/integrations/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("user_integrations")
    .select("refresh_token")
    .eq("user_id", user.id)
    .eq("provider", "google_calendar")
    .maybeSingle();

  // Best-effort revoke at Google's end
  if (row?.refresh_token) {
    try {
      const refresh = decrypt(row.refresh_token);
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`,
        { method: "POST" }
      );
    } catch (err) {
      console.error("[gcal/disconnect] revoke failed (non-blocking):", err);
    }
  }

  // calendar_event_links has no DELETE policy for authenticated users —
  // service-role client is required to purge mapping rows.
  const service = getServiceClient();
  await service.from("calendar_event_links").delete().eq("user_id", user.id);

  // RLS policy "user_integrations_delete_own" allows the user to delete their own row.
  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "google_calendar");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
