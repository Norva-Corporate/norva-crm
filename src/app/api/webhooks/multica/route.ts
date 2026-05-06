import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractLeadFields } from "@/lib/leads/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function readSecret(req: NextRequest): string {
  const headerSecret = req.headers.get("x-webhook-secret");
  if (headerSecret) return headerSecret;
  const auth = req.headers.get("authorization");
  if (auth) return auth.replace(/^Bearer\s+/i, "");
  return "";
}

export async function POST(req: NextRequest) {
  const expected = process.env.MULTICA_WEBHOOK_SECRET ?? "";
  const provided = readSecret(req);
  if (!expected || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Source tagging (?source= query param or x-source header, default "multica")
  const url = new URL(req.url);
  const source =
    req.headers.get("x-source") ??
    url.searchParams.get("source") ??
    "multica";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Accept: single lead, or { leads: [...] }, or [...]
  let items: unknown[];
  if (Array.isArray(body)) {
    items = body;
  } else if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { leads?: unknown[] }).leads)
  ) {
    items = (body as { leads: unknown[] }).leads;
  } else {
    items = [body];
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "no leads in payload" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "server misconfigured (missing supabase env)" },
      { status: 500 }
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const rows = items.map((item) => {
    const f = extractLeadFields(item);
    return {
      source,
      external_id: f.externalId,
      email: f.email,
      first_name: f.firstName,
      last_name: f.lastName,
      phone: f.phone,
      role: f.role,
      company_name: f.companyName,
      company_domain: f.companyDomain,
      raw_payload: item,
    };
  });

  const withId = rows.filter((r) => r.external_id);
  const noId = rows.filter((r) => !r.external_id);

  let inserted = 0;
  if (withId.length > 0) {
    const { data, error } = await supabase
      .from("lead_imports")
      .upsert(withId, {
        onConflict: "source,external_id",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted += data?.length ?? 0;
  }
  if (noId.length > 0) {
    const { data, error } = await supabase
      .from("lead_imports")
      .insert(noId)
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    inserted += data?.length ?? 0;
  }

  return NextResponse.json({
    received: items.length,
    inserted,
    duplicates: items.length - inserted,
    source,
  });
}
