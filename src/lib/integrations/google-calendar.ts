import "server-only";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";

// ============================================================
// Types
// ============================================================
export type SourceKind =
  | "deal"
  | "project_start"
  | "project_end"
  | "task"
  | "invoice";

export interface SyncableEvent {
  sourceKind: SourceKind;
  sourceId: string;
  summary: string;
  date: string; // YYYY-MM-DD
  description: string | null;
  href: string; // path inside the CRM, e.g. /dashboard/pipeline
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

// ============================================================
// Service-role client (bypasses RLS — used only server-side from sync engine)
// ============================================================
function getServiceClient() {
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
// Token lifecycle
// ============================================================
const REFRESH_THRESHOLD_MS = 60_000;

async function refreshAccessToken(
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
      res.status === 400 || res.status === 401 ? "invalid_grant" : "refresh_http";
    throw err;
  }
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
}

async function getValidAccessToken(
  userId: string
): Promise<{ token: string; calendarId: string | null; integrationId: string }> {
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
    const refreshed = await refreshAccessToken(refreshToken);
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

// ============================================================
// Google Calendar API helpers
// ============================================================
const GCAL_BASE = "https://www.googleapis.com/calendar/v3";

interface GcalError {
  status: number;
  reason?: string;
  body: string;
}

async function gcalFetch(
  path: string,
  init: RequestInit & { token: string }
): Promise<Response> {
  const { token, ...rest } = init;
  const res = await fetch(`${GCAL_BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  return res;
}

async function readGcalError(res: Response): Promise<GcalError> {
  const body = await res.text().catch(() => "");
  let reason: string | undefined;
  try {
    const json = JSON.parse(body) as {
      error?: { errors?: { reason?: string }[] };
    };
    reason = json.error?.errors?.[0]?.reason;
  } catch {
    /* ignore */
  }
  return { status: res.status, reason, body };
}

export async function ensureCalendar(userId: string): Promise<string> {
  const supabase = getServiceClient();
  const { token, calendarId, integrationId } = await getValidAccessToken(userId);

  if (calendarId) {
    // Verify it still exists
    const res = await gcalFetch(
      `/calendars/${encodeURIComponent(calendarId)}`,
      { method: "GET", token }
    );
    if (res.ok) return calendarId;
    if (res.status !== 404) {
      const err = await readGcalError(res);
      throw new Error(`gcal calendars.get failed: ${err.status} ${err.body}`);
    }
    // 404 → user deleted the calendar; fall through and recreate
  }

  const createRes = await gcalFetch("/calendars", {
    method: "POST",
    token,
    body: JSON.stringify({
      summary: "Norva CRM",
      description: "Événements synchronisés depuis Norva CRM",
      timeZone: "Europe/Paris",
    }),
  });
  if (!createRes.ok) {
    const err = await readGcalError(createRes);
    throw new Error(`gcal calendars.insert failed: ${err.status} ${err.body}`);
  }
  const created = (await createRes.json()) as { id: string };
  await supabase
    .from("user_integrations")
    .update({ google_calendar_id: created.id })
    .eq("id", integrationId);
  return created.id;
}

function nextDayISO(dateISO: string): string {
  // Google all-day event end is exclusive — add 1 day.
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildEventBody(ev: SyncableEvent) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    summary: ev.summary,
    start: { date: ev.date },
    end: { date: nextDayISO(ev.date) },
    description: ev.description ?? undefined,
    source: baseUrl
      ? { title: "Norva CRM", url: `${baseUrl}${ev.href}` }
      : undefined,
    extendedProperties: {
      private: {
        norvaKind: ev.sourceKind,
        norvaId: ev.sourceId,
      },
    },
  };
}

// ============================================================
// Per-user upsert / delete (called by syncEntityToAllConnectedUsers)
// ============================================================
async function upsertEventForUser(
  userId: string,
  ev: SyncableEvent
): Promise<void> {
  const supabase = getServiceClient();
  const calendarId = await ensureCalendar(userId);
  const { token } = await getValidAccessToken(userId);

  const { data: link } = await supabase
    .from("calendar_event_links")
    .select("google_event_id, google_calendar_id")
    .eq("user_id", userId)
    .eq("source_kind", ev.sourceKind)
    .eq("source_id", ev.sourceId)
    .maybeSingle();

  const body = JSON.stringify(buildEventBody(ev));

  if (link?.google_event_id && link.google_calendar_id === calendarId) {
    const patchRes = await gcalFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(link.google_event_id)}`,
      { method: "PATCH", token, body }
    );
    if (patchRes.ok) {
      await supabase
        .from("calendar_event_links")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("source_kind", ev.sourceKind)
        .eq("source_id", ev.sourceId);
      return;
    }
    if (patchRes.status !== 404) {
      const err = await readGcalError(patchRes);
      throw new Error(`gcal events.patch failed: ${err.status} ${err.body}`);
    }
    // 404 → event was deleted in Google; fall through to recreate
  }

  // Create new event (and replace any stale link row)
  const insertRes = await gcalFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", token, body }
  );
  if (!insertRes.ok) {
    const err = await readGcalError(insertRes);
    throw new Error(`gcal events.insert failed: ${err.status} ${err.body}`);
  }
  const inserted = (await insertRes.json()) as { id: string };

  await supabase
    .from("calendar_event_links")
    .upsert(
      {
        user_id: userId,
        source_kind: ev.sourceKind,
        source_id: ev.sourceId,
        google_event_id: inserted.id,
        google_calendar_id: calendarId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,source_kind,source_id" }
    );
}

async function deleteEventForUser(
  userId: string,
  sourceKind: SourceKind,
  sourceId: string
): Promise<void> {
  const supabase = getServiceClient();
  const { data: link } = await supabase
    .from("calendar_event_links")
    .select("google_event_id, google_calendar_id")
    .eq("user_id", userId)
    .eq("source_kind", sourceKind)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (!link) return; // nothing to clean up

  const { token } = await getValidAccessToken(userId);
  const res = await gcalFetch(
    `/calendars/${encodeURIComponent(link.google_calendar_id)}/events/${encodeURIComponent(link.google_event_id)}`,
    { method: "DELETE", token }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await readGcalError(res);
    throw new Error(`gcal events.delete failed: ${err.status} ${err.body}`);
  }
  await supabase
    .from("calendar_event_links")
    .delete()
    .eq("user_id", userId)
    .eq("source_kind", sourceKind)
    .eq("source_id", sourceId);
}

// ============================================================
// Entity loaders — convert a CRM row to a SyncableEvent (or null = skip/delete)
// ============================================================
function fmtEUR(n: number | string | null | undefined): string | null {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

async function loadDealEvent(
  supabase: ReturnType<typeof getServiceClient>,
  id: string
): Promise<SyncableEvent | null> {
  const { data } = await supabase
    .from("deals")
    .select("id, title, stage, value, expected_close_date")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.expected_close_date) return null;
  const value = fmtEUR(data.value);
  return {
    sourceKind: "deal",
    sourceId: data.id,
    summary: `[Deal] ${data.title}${value ? ` — ${value}` : ""}`,
    date: data.expected_close_date,
    description: `Étape: ${data.stage}${value ? ` · Montant: ${value}` : ""}`,
    href: "/dashboard/pipeline",
  };
}

async function loadTaskEvent(
  supabase: ReturnType<typeof getServiceClient>,
  id: string
): Promise<SyncableEvent | null> {
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.due_date) return null;
  if (data.status === "cancelled") return null;
  return {
    sourceKind: "task",
    sourceId: data.id,
    summary: `[Tâche] ${data.title}`,
    date: data.due_date,
    description: `Priorité: ${data.priority} · Statut: ${data.status}`,
    href: "/dashboard/taches",
  };
}

async function loadProjectEvents(
  supabase: ReturnType<typeof getServiceClient>,
  id: string
): Promise<{ start: SyncableEvent | null; end: SyncableEvent | null }> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, status, start_date, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { start: null, end: null };
  const skip = data.status === "annule";
  return {
    start:
      data.start_date && !skip
        ? {
            sourceKind: "project_start",
            sourceId: data.id,
            summary: `[Projet ▶] ${data.name}`,
            date: data.start_date,
            description: `Démarrage du projet · Statut: ${data.status}`,
            href: `/dashboard/projets/${data.id}`,
          }
        : null,
    end:
      data.end_date && !skip
        ? {
            sourceKind: "project_end",
            sourceId: data.id,
            summary: `[Projet ■] ${data.name}`,
            date: data.end_date,
            description: `Échéance du projet · Statut: ${data.status}`,
            href: `/dashboard/projets/${data.id}`,
          }
        : null,
  };
}

async function loadInvoiceEvent(
  supabase: ReturnType<typeof getServiceClient>,
  id: string
): Promise<SyncableEvent | null> {
  const { data } = await supabase
    .from("invoices")
    .select("id, number, type, status, due_date, total")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.due_date) return null;
  if (data.type !== "invoice") return null;
  if (data.status === "annulee" || data.status === "payee") return null;
  const total = fmtEUR(data.total);
  return {
    sourceKind: "invoice",
    sourceId: data.id,
    summary: `[Facture] ${data.number}${total ? ` — ${total}` : ""}`,
    date: data.due_date,
    description: `Statut: ${data.status}${total ? ` · Total: ${total}` : ""}`,
    href: `/dashboard/facturation/${data.id}`,
  };
}

// ============================================================
// Public API: sync one CRM entity to every connected user.
// Safe to fire-and-forget — never throws to the caller.
// ============================================================
export async function syncEntityToAllConnectedUsers(
  sourceKind: "deal" | "task" | "project" | "invoice",
  sourceId: string
): Promise<void> {
  try {
    const supabase = getServiceClient();

    // 1. Load the desired event(s) — null means "should be absent in Google Cal".
    let desired: { kind: SourceKind; ev: SyncableEvent | null }[];
    if (sourceKind === "deal") {
      desired = [{ kind: "deal", ev: await loadDealEvent(supabase, sourceId) }];
    } else if (sourceKind === "task") {
      desired = [{ kind: "task", ev: await loadTaskEvent(supabase, sourceId) }];
    } else if (sourceKind === "invoice") {
      desired = [
        { kind: "invoice", ev: await loadInvoiceEvent(supabase, sourceId) },
      ];
    } else {
      const { start, end } = await loadProjectEvents(supabase, sourceId);
      desired = [
        { kind: "project_start", ev: start },
        { kind: "project_end", ev: end },
      ];
    }

    // 2. List every user with a google_calendar integration.
    const { data: integrations } = await supabase
      .from("user_integrations")
      .select("user_id, last_sync_error")
      .eq("provider", "google_calendar");
    if (!integrations || integrations.length === 0) return;

    // 3. Per user × per desired slot, upsert or delete.
    await Promise.all(
      integrations.map(async (intg) => {
        if (intg.last_sync_error === "reauth_required") return; // skip until user re-auths
        for (const slot of desired) {
          try {
            if (slot.ev) {
              await upsertEventForUser(intg.user_id, slot.ev);
            } else {
              await deleteEventForUser(intg.user_id, slot.kind, sourceId);
            }
          } catch (err) {
            console.error(
              `[gcal sync] ${slot.kind} ${sourceId} for user ${intg.user_id}:`,
              err
            );
            await supabase
              .from("user_integrations")
              .update({
                last_sync_error: (err as Error).message?.slice(0, 500) ?? "error",
              })
              .eq("user_id", intg.user_id)
              .eq("provider", "google_calendar");
          }
        }
        await supabase
          .from("user_integrations")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("user_id", intg.user_id)
          .eq("provider", "google_calendar");
      })
    );
  } catch (err) {
    console.error("[gcal sync] top-level error:", err);
  }
}

// ============================================================
// Bulk resync — used by the /resync route. Iterates a date window and
// upserts every CRM entity found into the calling user's calendar.
// Returns counts per kind.
// ============================================================
export async function resyncAllForUser(
  userId: string,
  fromISO: string,
  toISO: string
): Promise<{ synced: number; errors: number }> {
  const supabase = getServiceClient();
  await ensureCalendar(userId);

  const [deals, projects, tasks, invoices] = await Promise.all([
    supabase
      .from("deals")
      .select("id, expected_close_date")
      .not("expected_close_date", "is", null)
      .gte("expected_close_date", fromISO)
      .lte("expected_close_date", toISO),
    supabase
      .from("projects")
      .select("id, start_date, end_date")
      .or(
        `and(start_date.gte.${fromISO},start_date.lte.${toISO}),and(end_date.gte.${fromISO},end_date.lte.${toISO})`
      ),
    supabase
      .from("tasks")
      .select("id, due_date")
      .not("due_date", "is", null)
      .gte("due_date", fromISO)
      .lte("due_date", toISO),
    supabase
      .from("invoices")
      .select("id, due_date, type")
      .eq("type", "invoice")
      .not("due_date", "is", null)
      .gte("due_date", fromISO)
      .lte("due_date", toISO),
  ]);

  let synced = 0;
  let errors = 0;

  async function run(loader: () => Promise<SyncableEvent | null>) {
    try {
      const ev = await loader();
      if (!ev) return;
      await upsertEventForUser(userId, ev);
      synced++;
    } catch (err) {
      errors++;
      console.error("[gcal resync] error:", err);
    }
  }

  for (const d of deals.data ?? []) {
    await run(() => loadDealEvent(supabase, d.id));
  }
  for (const p of projects.data ?? []) {
    const { start, end } = await loadProjectEvents(supabase, p.id);
    if (start) {
      try {
        await upsertEventForUser(userId, start);
        synced++;
      } catch (err) {
        errors++;
        console.error("[gcal resync] project_start error:", err);
      }
    }
    if (end) {
      try {
        await upsertEventForUser(userId, end);
        synced++;
      } catch (err) {
        errors++;
        console.error("[gcal resync] project_end error:", err);
      }
    }
  }
  for (const t of tasks.data ?? []) {
    await run(() => loadTaskEvent(supabase, t.id));
  }
  for (const inv of invoices.data ?? []) {
    await run(() => loadInvoiceEvent(supabase, inv.id));
  }

  await supabase
    .from("user_integrations")
    .update({ last_sync_at: new Date().toISOString(), last_sync_error: null })
    .eq("user_id", userId)
    .eq("provider", "google_calendar");

  return { synced, errors };
}

// Re-export for the OAuth callback route to bootstrap the calendar
export { getServiceClient };
