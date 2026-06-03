import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEffectiveInvoiceStatus } from "@/lib/utils";

// ============================================================
// Dashboard data — Phase D3.2
// ============================================================
// Agrégats spécifiques à la page d'accueil. Sort de page.tsx pour
// rester avec les autres "list/read" actions et garder la page
// purement présentationnelle.
// ============================================================

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function isoInDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function startOfYearISO() {
  return `${new Date().getFullYear()}-01-01`;
}

export interface DashboardData {
  pipelineWeighted: number;
  winRate: number | null;
  winRateBase: number;
  revenueYTD: number;
  pendingTotal: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recentDeals: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overdueInvoices: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dealsToClose: any[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const today = todayISO();
  const in30 = isoInDays(30);
  const startYear = startOfYearISO();

  // 90-day window for win rate
  const ninetyAgo = new Date();
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const ninetyAgoISO = ninetyAgo.toISOString();

  const [deals, invoices, recentDeals, overdueInvoices, dealsToClose] =
    await Promise.all([
      supabase.from("deals").select("value, stage, probability, updated_at"),
      supabase
        .from("invoices")
        .select("total, status, type, issue_date, due_date")
        .eq("type", "invoice")
        .neq("status", "annulee"),
      supabase
        .from("deals")
        .select(
          "id, title, stage, value, contact:contacts(first_name, last_name), company:companies(name)"
        )
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("invoices")
        .select(
          "id, number, total, due_date, contact:contacts(first_name, last_name), company:companies(name)"
        )
        .eq("type", "invoice")
        .eq("status", "envoyee")
        .lt("due_date", today)
        .order("due_date", { ascending: true })
        .limit(5),
      supabase
        .from("deals")
        .select(
          "id, title, stage, value, expected_close_date, contact:contacts(first_name, last_name), company:companies(name)"
        )
        .not("stage", "in", "(won,lost)")
        .not("expected_close_date", "is", null)
        .gte("expected_close_date", today)
        .lte("expected_close_date", in30)
        .order("expected_close_date", { ascending: true })
        .limit(5),
    ]);

  const allDeals = deals.data ?? [];
  const openDeals = allDeals.filter(
    (d) => d.stage !== "won" && d.stage !== "lost"
  );
  const pipelineWeighted = openDeals.reduce(
    (s, d) => s + (Number(d.value) || 0) * ((Number(d.probability) || 0) / 100),
    0
  );

  const recentClosed = allDeals.filter(
    (d) =>
      (d.stage === "won" || d.stage === "lost") &&
      d.updated_at &&
      d.updated_at >= ninetyAgoISO
  );
  const wonCount = recentClosed.filter((d) => d.stage === "won").length;
  const winRate =
    recentClosed.length > 0
      ? Math.round((wonCount / recentClosed.length) * 100)
      : null;

  const allInvoices = invoices.data ?? [];
  const revenueYTD = allInvoices
    .filter((i) => i.status === "payee" && i.issue_date >= startYear)
    .reduce((s, i) => s + (Number(i.total) || 0), 0);

  const pendingTotal = allInvoices
    .filter((i) => {
      const eff = getEffectiveInvoiceStatus({
        status: i.status,
        due_date: i.due_date,
      });
      return eff === "envoyee";
    })
    .reduce((s, i) => s + (Number(i.total) || 0), 0);

  return {
    pipelineWeighted,
    winRate,
    winRateBase: recentClosed.length,
    revenueYTD,
    pendingTotal,
    recentDeals: recentDeals.data ?? [],
    overdueInvoices: overdueInvoices.data ?? [],
    dealsToClose: dealsToClose.data ?? [],
  };
}

export async function getCurrentProfileSummary() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { firstName: "", email: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const firstName =
    profile?.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "";

  return { firstName, email: profile?.email ?? user.email ?? null };
}
