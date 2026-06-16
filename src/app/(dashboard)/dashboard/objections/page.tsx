import React from "react";
import { notFound } from "next/navigation";
import {
  MessageSquareWarning,
  Target,
  Flame,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/server";
import {
  getObjectionStats,
  type ObjectionPeriod,
} from "@/lib/actions/objections";
import { STAT_MEMBERS } from "@/lib/team";
import {
  ObjectionsToolbar,
  type ToolbarRep,
} from "@/components/objections/ObjectionsToolbar";
import {
  StackedObjectionBars,
  StageBreakdown,
  RepBreakdown,
  PainBreakdown,
  OutcomeLegend,
  ObjectionsEmptyState,
} from "@/components/objections/ObjectionCharts";

export const dynamic = "force-dynamic";

function parsePeriod(v: string | undefined): ObjectionPeriod {
  return v === "30d" || v === "90d" ? v : "all";
}

export default async function ObjectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; rep?: string }>;
}) {
  if (!(await hasPermission("objections.read"))) {
    notFound();
  }

  const resolved = await searchParams;
  const period = parsePeriod(resolved.period);
  const repId = resolved.rep ?? null;

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email");

  // Résout les membres affichés dans les stats (STAT_MEMBERS) en profile ids.
  const emailToId = new Map(
    (profiles ?? []).map((p) => [
      (p.email ?? "").toLowerCase(),
      p.id as string,
    ])
  );
  const reps: ToolbarRep[] = STAT_MEMBERS.map((o) => {
    const id = emailToId.get(o.email.toLowerCase());
    return id
      ? { id, shortName: o.shortName, accent: o.accent }
      : null;
  }).filter((r): r is ToolbarRep => r !== null);

  const stats = await getObjectionStats({ period, repId });

  const kpis = [
    {
      title: "Objections loggées",
      value: String(stats.total),
      icon: MessageSquareWarning,
      bg: "bg-accent/10",
      color: "text-accent",
    },
    {
      title: "Taux de closing global",
      value: stats.closingRate == null ? "—" : `${stats.closingRate}%`,
      sub:
        stats.withOutcome > 0
          ? `${stats.accepted}/${stats.withOutcome} acceptées`
          : "Aucune issue renseignée",
      icon: Target,
      bg: "bg-[#22C55E]/10",
      color: "text-[#4ADE80]",
    },
    {
      title: "Objection n°1",
      value: stats.topObjection?.label ?? "—",
      sub: stats.topObjection ? `${stats.topObjection.count} fois` : null,
      icon: Flame,
      bg: "bg-[#F59E0B]/10",
      color: "text-[#FCD34D]",
      small: true,
    },
    {
      title: "Étape la plus chargée",
      value: stats.busiestStage?.label ?? "—",
      sub: stats.busiestStage ? `${stats.busiestStage.count} objections` : null,
      icon: Layers,
      bg: "bg-[#3B82F6]/10",
      color: "text-[#60A5FA]",
    },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Objections" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        <ObjectionsToolbar reps={reps} />

        {stats.total === 0 ? (
          <ObjectionsEmptyState />
        ) : (
          <>
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
                      <p
                        className={
                          k.small
                            ? "text-base font-semibold text-foreground leading-tight"
                            : "text-2xl font-bold text-foreground"
                        }
                      >
                        {k.value}
                      </p>
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

            {/* Objections les plus fréquentes */}
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Objections les plus fréquentes
                </CardTitle>
                <OutcomeLegend />
              </CardHeader>
              <CardContent>
                <StackedObjectionBars data={stats.byObjection} />
              </CardContent>
            </Card>

            {/* Par étape */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5" />
                  Par étape
                </CardTitle>
              </CardHeader>
              <CardContent>
                <StageBreakdown data={stats.byStage} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Par commercial */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5" />
                    Par commercial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RepBreakdown data={stats.byRep} />
                </CardContent>
              </Card>

              {/* Par pain */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5" />
                    Par pain identifié
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PainBreakdown data={stats.byPain} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
