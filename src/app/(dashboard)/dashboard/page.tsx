import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  CircleDollarSign,
  Target,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  getEffectiveInvoiceStatus,
} from "@/lib/utils";

const stageBadgeMap: Record<
  string,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  prospect: "prospect",
  qualified: "qualified",
  proposal: "proposal",
  negotiation: "negotiation",
  won: "won",
  lost: "lost",
};

const stageLabel: Record<string, string> = {
  prospect: "Prospect",
  qualified: "Qualifié",
  proposal: "Devis",
  negotiation: "Négo.",
  won: "Gagné",
  lost: "Perdu",
};

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

function startOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function getDashboardData(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const today = todayISO();
  const in30 = isoInDays(30);
  const startYear = startOfYearISO();

  // 90-day window for win rate
  const ninetyAgo = new Date();
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);
  const ninetyAgoISO = ninetyAgo.toISOString();

  const [deals, invoices, recentDeals, overdueInvoices, dealsToClose] =
    await Promise.all([
      // Pipeline + win rate computation
      supabase.from("deals").select("value, stage, probability, updated_at"),
      // Encaissé YTD + en attente
      supabase
        .from("invoices")
        .select("total, status, type, issue_date, due_date")
        .eq("type", "invoice")
        .neq("status", "annulee"),
      // Recent deals widget
      supabase
        .from("deals")
        .select(
          "id, title, stage, value, contact:contacts(first_name, last_name), company:companies(name)"
        )
        .order("updated_at", { ascending: false })
        .limit(5),
      // Overdue invoices: envoyee + due_date < today
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
      // Deals expected to close in next 30 days, still open
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const firstName =
    profile?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  const {
    pipelineWeighted,
    winRate,
    winRateBase,
    revenueYTD,
    pendingTotal,
    recentDeals,
    overdueInvoices,
    dealsToClose,
  } = await getDashboardData(supabase);

  const stats = [
    {
      title: "CA encaissé YTD",
      value: formatCurrency(revenueYTD),
      icon: Wallet,
      href: "/dashboard/facturation",
      color: "text-[#4ADE80]",
      bg: "bg-[#22C55E]/10",
    },
    {
      title: "En attente de paiement",
      value: formatCurrency(pendingTotal),
      icon: CircleDollarSign,
      href: "/dashboard/facturation",
      color: "text-[#60A5FA]",
      bg: "bg-[#3B82F6]/10",
    },
    {
      title: "Pipeline pondéré",
      value: formatCurrency(pipelineWeighted),
      icon: TrendingUp,
      href: "/dashboard/pipeline",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "Taux de conversion 90j",
      value: winRate == null ? "—" : `${winRate}%`,
      sub:
        winRate == null
          ? "Aucun deal clôturé sur 90 jours"
          : `sur ${winRateBase} deals clôturés`,
      icon: Target,
      href: "/dashboard/pipeline",
      color: "text-[#FCD34D]",
      bg: "bg-[#F59E0B]/10",
    },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Tableau de bord" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-foreground">
            Bonjour {firstName}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Voici un aperçu de votre activité.
          </p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:shadow-card-hover hover:border-[var(--border)] transition-all cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`h-9 w-9 flex items-center justify-center ${stat.bg}`}
                      >
                        <Icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stat.title}
                    </p>
                    {stat.sub && (
                      <p className="text-[10px] text-muted-foreground/80 mt-1">
                        {stat.sub}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Two-column actionable widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Overdue invoices */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                Factures en retard
              </CardTitle>
              <Link
                href="/dashboard/facturation"
                className="text-xs text-accent hover:text-accent-hover transition-colors"
              >
                Tout voir →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {overdueInvoices.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Aucune facture en retard 🎉
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {overdueInvoices.map(
                    (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      inv: any
                    ) => (
                      <Link
                        key={inv.id}
                        href={`/dashboard/facturation/${inv.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--muted)]/30 transition-colors"
                      >
                        <Clock className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-foreground">
                            {inv.number}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {inv.contact
                              ? `${inv.contact.first_name} ${inv.contact.last_name}`
                              : inv.company?.name ?? "—"}
                            {" · échéance "}
                            {formatDate(inv.due_date)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-destructive font-mono">
                          {formatCurrency(inv.total ?? 0)}
                        </p>
                      </Link>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deals to close in 30 days */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-accent" />
                Deals à closer (30j)
              </CardTitle>
              <Link
                href="/dashboard/pipeline"
                className="text-xs text-accent hover:text-accent-hover transition-colors"
              >
                Pipeline →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {dealsToClose.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Aucun deal à closer dans les 30 jours.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {dealsToClose.map(
                    (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      deal: any
                    ) => (
                      <div
                        key={deal.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--muted)]/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {deal.title}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {deal.contact
                              ? `${deal.contact.first_name} ${deal.contact.last_name}`
                              : deal.company?.name ?? "—"}
                            {" · "}
                            {formatDate(deal.expected_close_date)}
                          </p>
                        </div>
                        <Badge
                          variant={stageBadgeMap[deal.stage] ?? "secondary"}
                        >
                          {stageLabel[deal.stage] ?? deal.stage}
                        </Badge>
                        <p className="text-sm font-semibold text-foreground font-mono w-20 text-right">
                          {deal.value ? formatCurrency(deal.value) : "—"}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Deals */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Deals récents</CardTitle>
            <Link
              href="/dashboard/pipeline"
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Voir le pipeline →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {!recentDeals || recentDeals.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                Aucun deal pour l&apos;instant.{" "}
                <Link
                  href="/dashboard/pipeline"
                  className="text-accent hover:underline"
                >
                  Créer le premier
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentDeals.map(
                  (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    deal: any
                  ) => (
                    <div
                      key={deal.id}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--muted)]/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {deal.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {deal.contact
                            ? `${deal.contact.first_name} ${deal.contact.last_name}`
                            : deal.company?.name ?? "—"}
                        </p>
                      </div>
                      <Badge variant={stageBadgeMap[deal.stage] ?? "secondary"}>
                        {stageLabel[deal.stage] ?? deal.stage}
                      </Badge>
                      <p className="text-sm font-semibold text-foreground w-28 text-right">
                        {deal.value ? formatCurrency(deal.value) : "—"}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
