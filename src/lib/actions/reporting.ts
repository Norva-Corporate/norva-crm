"use server";

import { createClient } from "@/lib/supabase/server";

export interface MonthlyRevenue {
  month: string; // YYYY-MM
  label: string; // "Jan", "Fév"
  revenue: number;
  invoiced: number;
}

export interface StageBucket {
  stage: string;
  count: number;
  value: number;
}

export interface TopClient {
  id: string;
  name: string;
  type: "company" | "contact";
  total: number;
  invoice_count: number;
}

export interface MemberPerf {
  id: string;
  name: string;
  won_count: number;
  won_value: number;
  open_count: number;
  open_value: number;
}

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface ReportData {
  monthly: MonthlyRevenue[];
  pipelineByStage: StageBucket[];
  pipelineWeighted: number;
  pipelineTotal: number;
  conversionByStage: { stage: string; count: number }[];
  winRate: number | null;
  winRateBase: number;
  averageDealSize: number;
  averageDaysToClose: number | null;
  topClients: TopClient[];
  members: MemberPerf[];
  totalRevenueYTD: number;
  totalInvoicedYTD: number;
}

export async function getReportData(): Promise<ReportData> {
  const supabase = await createClient();

  const today = new Date();
  const startYear = `${today.getFullYear()}-01-01`;
  const start12mo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const start12moISO = start12mo.toISOString().split("T")[0];

  const [{ data: invoices }, { data: deals }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, type, status, total, issue_date, company_id, contact_id, company:companies(id, name), contact:contacts(id, first_name, last_name)"
        )
        .eq("type", "invoice")
        .neq("status", "annulee"),
      supabase
        .from("deals")
        .select(
          "id, value, stage, probability, assigned_to, created_at, updated_at"
        ),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const profilesById = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  );

  // ----- Monthly revenue (12 months, paid + invoiced)
  const monthMap = new Map<string, { revenue: number; invoiced: number }>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start12mo);
    d.setMonth(d.getMonth() + i);
    monthMap.set(monthKey(d), { revenue: 0, invoiced: 0 });
  }
  for (const inv of invoices ?? []) {
    if (!inv.issue_date) continue;
    if (inv.issue_date < start12moISO) continue;
    const key = inv.issue_date.slice(0, 7);
    const slot = monthMap.get(key);
    if (!slot) continue;
    const total = Number(inv.total) || 0;
    slot.invoiced += total;
    if (inv.status === "payee") slot.revenue += total;
  }
  const monthly: MonthlyRevenue[] = [];
  const cursor = new Date(start12mo);
  for (let i = 0; i < 12; i++) {
    const key = monthKey(cursor);
    const slot = monthMap.get(key) ?? { revenue: 0, invoiced: 0 };
    monthly.push({
      month: key,
      label: MONTH_LABELS[cursor.getMonth()],
      revenue: slot.revenue,
      invoiced: slot.invoiced,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // ----- Pipeline by stage
  const STAGES = [
    "discussion",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ];
  const stageMap = new Map<string, StageBucket>();
  for (const s of STAGES) stageMap.set(s, { stage: s, count: 0, value: 0 });
  for (const d of deals ?? []) {
    const b = stageMap.get(d.stage);
    if (!b) continue;
    b.count += 1;
    b.value += Number(d.value) || 0;
  }
  const pipelineByStage = STAGES.map((s) => stageMap.get(s)!).filter(
    (b) => b.stage !== "won" && b.stage !== "lost"
  );
  const pipelineTotal = pipelineByStage.reduce((s, b) => s + b.value, 0);

  let pipelineWeighted = 0;
  for (const d of deals ?? []) {
    if (d.stage === "won" || d.stage === "lost") continue;
    pipelineWeighted +=
      (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100);
  }

  // ----- Conversion funnel (counts per stage including won/lost)
  const conversionByStage = STAGES.map((s) => ({
    stage: s,
    count: stageMap.get(s)?.count ?? 0,
  }));

  // ----- Win rate over last 90 days
  const ninetyAgo = new Date();
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const ninetyAgoISO = ninetyAgo.toISOString();
  const closed = (deals ?? []).filter(
    (d) =>
      (d.stage === "won" || d.stage === "lost") &&
      d.updated_at &&
      d.updated_at >= ninetyAgoISO
  );
  const wonClosed = closed.filter((d) => d.stage === "won");
  const winRate =
    closed.length > 0 ? Math.round((wonClosed.length / closed.length) * 100) : null;

  // ----- Average deal size (won)
  const averageDealSize =
    wonClosed.length > 0
      ? wonClosed.reduce((s, d) => s + (Number(d.value) || 0), 0) /
        wonClosed.length
      : 0;

  // ----- Average days to close (created → updated when stage = won)
  let totalDays = 0;
  let countDays = 0;
  for (const d of wonClosed) {
    if (d.created_at && d.updated_at) {
      const diff =
        (new Date(d.updated_at).getTime() -
          new Date(d.created_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (diff > 0) {
        totalDays += diff;
        countDays += 1;
      }
    }
  }
  const averageDaysToClose =
    countDays > 0 ? Math.round(totalDays / countDays) : null;

  // ----- Top clients by paid revenue YTD
  const clientMap = new Map<string, TopClient>();
  for (const inv of invoices ?? []) {
    if (inv.status !== "payee") continue;
    if (!inv.issue_date || inv.issue_date < startYear) continue;
    let id: string | null = null;
    let name = "—";
    let type: "company" | "contact" = "company";
    if (inv.company_id) {
      id = inv.company_id;
      const company = inv.company as unknown as
        | { name: string }
        | { name: string }[]
        | null;
      const cName = Array.isArray(company)
        ? company[0]?.name
        : company?.name;
      name = cName ?? "—";
      type = "company";
    } else if (inv.contact_id) {
      id = inv.contact_id;
      const contact = inv.contact as unknown as
        | { first_name: string; last_name: string }
        | { first_name: string; last_name: string }[]
        | null;
      const c = Array.isArray(contact) ? contact[0] : contact;
      name = c ? `${c.first_name} ${c.last_name}` : "—";
      type = "contact";
    }
    if (!id) continue;
    const existing = clientMap.get(id) ?? {
      id,
      name,
      type,
      total: 0,
      invoice_count: 0,
    };
    existing.total += Number(inv.total) || 0;
    existing.invoice_count += 1;
    clientMap.set(id, existing);
  }
  const topClients = Array.from(clientMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ----- Member performance
  const memberMap = new Map<string, MemberPerf>();
  for (const d of deals ?? []) {
    if (!d.assigned_to) continue;
    const profile = profilesById.get(d.assigned_to);
    const m = memberMap.get(d.assigned_to) ?? {
      id: d.assigned_to,
      name: profile?.full_name ?? profile?.email ?? "—",
      won_count: 0,
      won_value: 0,
      open_count: 0,
      open_value: 0,
    };
    if (d.stage === "won") {
      m.won_count += 1;
      m.won_value += Number(d.value) || 0;
    } else if (d.stage !== "lost") {
      m.open_count += 1;
      m.open_value += Number(d.value) || 0;
    }
    memberMap.set(d.assigned_to, m);
  }
  const members = Array.from(memberMap.values()).sort(
    (a, b) => b.won_value - a.won_value
  );

  const totalRevenueYTD = (invoices ?? [])
    .filter((i) => i.status === "payee" && i.issue_date >= startYear)
    .reduce((s, i) => s + (Number(i.total) || 0), 0);

  const totalInvoicedYTD = (invoices ?? [])
    .filter((i) => i.issue_date >= startYear)
    .reduce((s, i) => s + (Number(i.total) || 0), 0);

  return {
    monthly,
    pipelineByStage,
    pipelineWeighted,
    pipelineTotal,
    conversionByStage,
    winRate,
    winRateBase: closed.length,
    averageDealSize,
    averageDaysToClose,
    topClients,
    members,
    totalRevenueYTD,
    totalInvoicedYTD,
  };
}
