import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Target,
  Clock,
  DollarSign,
  Trophy,
  Users,
  Building2,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReportData } from "@/lib/actions/reporting";
import {
  MonthlyRevenueChart,
  PipelineByStageChart,
  ConversionFunnel,
} from "@/components/reporting/charts";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportingPage() {
  const data = await getReportData();

  const kpis = [
    {
      title: "CA encaissé YTD",
      value: formatCurrency(data.totalRevenueYTD),
      icon: DollarSign,
      bg: "bg-[#22C55E]/10",
      color: "text-[#4ADE80]",
    },
    {
      title: "CA facturé YTD",
      value: formatCurrency(data.totalInvoicedYTD),
      sub: `Reste à encaisser ${formatCurrency(
        Math.max(0, data.totalInvoicedYTD - data.totalRevenueYTD)
      )}`,
      icon: TrendingUp,
      bg: "bg-[#3B82F6]/10",
      color: "text-[#60A5FA]",
    },
    {
      title: "Taux de conversion 90j",
      value: data.winRate == null ? "—" : `${data.winRate}%`,
      sub:
        data.winRate == null
          ? "Aucun deal clôturé sur 90 jours"
          : `${data.winRateBase} deals clôturés`,
      icon: Target,
      bg: "bg-[#F59E0B]/10",
      color: "text-[#FCD34D]",
    },
    {
      title: "Délai moyen de closing",
      value:
        data.averageDaysToClose == null
          ? "—"
          : `${data.averageDaysToClose} j`,
      sub:
        data.averageDealSize > 0
          ? `Panier moyen ${formatCurrency(data.averageDealSize)}`
          : null,
      icon: Clock,
      bg: "bg-accent/10",
      color: "text-accent",
    },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Reporting" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.title}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`h-9 w-9 flex items-center justify-center ${k.bg}`}
                    >
                      <Icon className={`h-4 w-4 ${k.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {k.title}
                  </p>
                  {k.sub && (
                    <p className="text-[10px] text-muted-foreground/80 mt-1">
                      {k.sub}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Monthly revenue */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>Revenu mensuel — 12 derniers mois</CardTitle>
            <span className="text-xs text-muted-foreground">
              Encaissé vs facturé
            </span>
          </CardHeader>
          <CardContent>
            <MonthlyRevenueChart data={data.monthly} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pipeline by stage */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Pipeline par étape
              </CardTitle>
              <span className="text-xs text-muted-foreground font-mono">
                {formatCurrency(data.pipelineTotal)} · pondéré{" "}
                {formatCurrency(data.pipelineWeighted)}
              </span>
            </CardHeader>
            <CardContent>
              <PipelineByStageChart data={data.pipelineByStage} />
            </CardContent>
          </Card>

          {/* Conversion funnel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5" />
                Entonnoir de conversion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConversionFunnel data={data.conversionByStage} />
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top clients */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5" />
                Top clients (CA encaissé YTD)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.topClients.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Aucun encaissement cette année.
                </p>
              ) : (
                <ol className="divide-y divide-[var(--border)]">
                  {data.topClients.map((c, idx) => {
                    const href =
                      c.type === "company"
                        ? `/dashboard/companies/${c.id}`
                        : `/dashboard/contacts/${c.id}`;
                    const Icon = c.type === "company" ? Building2 : Users;
                    return (
                      <li key={c.id}>
                        <Link
                          href={href}
                          className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--muted)]/30 transition-colors"
                        >
                          <span className="text-xs text-muted-foreground w-5 font-mono">
                            #{idx + 1}
                          </span>
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">
                              {c.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {c.invoice_count} facture
                              {c.invoice_count > 1 ? "s" : ""}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-foreground font-mono">
                            {formatCurrency(c.total)}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Members performance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Performance par membre
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.members.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Aucun deal assigné.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">
                          Membre
                        </th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                          Gagnés
                        </th>
                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">
                          Ouverts
                        </th>
                        <th className="text-right px-5 py-2.5 font-medium text-muted-foreground">
                          CA gagné
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.members.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <td className="px-5 py-3 text-foreground">{m.name}</td>
                          <td className="text-right px-3 py-3 font-mono text-foreground">
                            {m.won_count}
                          </td>
                          <td className="text-right px-3 py-3 font-mono text-muted-foreground">
                            {m.open_count} · {formatCurrency(m.open_value)}
                          </td>
                          <td className="text-right px-5 py-3 font-mono text-foreground font-semibold">
                            {formatCurrency(m.won_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
