import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resyncAllForUser } from "@/lib/integrations/google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Window: last 30 days -> next 12 months (matches what most users care about)
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  const to = new Date(now);
  to.setFullYear(to.getFullYear() + 1);

  const fromISO = from.toISOString().slice(0, 10);
  const toISO = to.toISOString().slice(0, 10);

  try {
    const { synced, errors } = await resyncAllForUser(user.id, fromISO, toISO);
    return NextResponse.json({ success: true, synced, errors, fromISO, toISO });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[gcal/resync] failed:", err);
    return NextResponse.json(
      { error: "resync_failed", detail: message },
      { status: 500 }
    );
  }
}
