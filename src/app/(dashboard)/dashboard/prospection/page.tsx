import React from "react";
import { notFound } from "next/navigation";
import {
  PhoneCall,
  PhoneIncoming,
  CalendarCheck,
  FileSignature,
  Users,
  CalendarRange,
  Layers,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/server";
import { getCallStats, type CallPeriod } from "@/lib/actions/calls";
import { TO_CONTACT_OWNERS } from "@/lib/team";
import {
  ProspectionToolbar,
  type ToolbarRep,
} from "@/components/calls/ProspectionToolbar";
import {
  ReachabilityBreakdown,
  CallRepBreakdown,
  WeeklyRecapTable,
  ProspectionEmptyState,
} from "@/components/calls/CallCharts";

export const dynamic = "force-dynamic";

function parsePeriod(v: string | undefined): CallPeriod {
  return v === "30d" || v === "90d" ? v : "all";
}

export default async function ProspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; rep?: string }>;
}) {
  if (!(await hasPermission("calls.read"))) {
    notFound();
  }

  const resolved = await searchParams;
  const period = parsePeriod(resolved.period);
  const repId = resolved.rep ?? null;

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email");

  // Résout les commerciaux canoniques (TO_CONTACT_OWNERS) en profile ids.
  const emailToId = new Map(
    (profiles ?? []).map((p) => [(p.email ?? "").toLowerCase(), p.id as string])
  );
  const reps: ToolbarRep[] = TO_CONTACT_OWNERS.map((o) => {
    const id = emailToId.get(o.email.toLowerCase());
    return id ? { id, shortName: o.shortName, accent: o.accent } : null;
  }).filter((r): r is ToolbarRep => r !== null);

  const stats = await getCallStats({ period, repId });

  const kpis = [
    {
      title: "Appels passés",
      value: String(stats.appels),
      sub:
        stats.sansReponse > 0
          ? `${stats.sansReponse} sans réponse`
          : "Volume sur la période",
      icon: PhoneCall,
      bg: "bg-accent/10",
      color: "text-accent",
    },
    {
      title: "Taux de réponse",
      value: stats.tauxReponse == null ? "—" : `${stats.tauxReponse}%`,
      sub: `${stats.repondus} répondus / ${stats.appels} appels`,
      icon: PhoneIncoming,
      bg: "bg-[#3BD17A]/10",
      color: "text-[#4ADE80]",
    },
    {
      title: "RDV obtenus",
      value: String(stats.rdv),
      sub:
        stats.rdvParAppels == null
          ? "Aucun appel"
          : `${stats.rdvParAppels}% des appels · ${stats.rdvParRepondus ?? 0}% des répondus`,
      icon: CalendarCheck,
      bg: "bg-[#3B7BF5]/10",
      color: "text-[#60A5FA]",
    },
    {
      title: "Contrats signés",
      value: String(stats.signes),
      sub:
        stats.signesParRdv == null
          ? `${stats.devisEnvoyes} devis envoyés`
          : `${stats.signesParRdv}% des RDV · ${stats.devisEnvoyes} devis envoyés`,
      icon: FileSignature,
      bg: "bg-[#22C55E]/10",
      color: "text-[#4ADE80]",
    },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Prospection" />

      <div className="flex-1 p-4 md:p-6 space-y-6 animate-fade-in">
        <ProspectionToolbar reps={reps} />

        {stats.appels === 0 ? (
          <ProspectionEmptyState />
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
                      <p className="text-2xl font-bold text-foreground">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Joignabilité */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    Joignabilité des appels
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReachabilityBreakdown stats={stats} />
                </CardContent>
              </Card>

              {/* Par commercial */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Par commercial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CallRepBreakdown data={stats.byRep} />
                </CardContent>
              </Card>
            </div>

            {/* Récap hebdomadaire */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="h-3.5 w-3.5" />
                  Récap hebdomadaire
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyRecapTable data={stats.weekly} />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
