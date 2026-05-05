import React from "react";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Building2,
  TrendingUp,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { formatCurrency, formatRelativeDate } from "@/lib/utils";
import type { Deal } from "@/types";
import Link from "next/link";

async function getDashboardStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [
    { count: contactsCount },
    { count: companiesCount },
    { data: deals },
    { data: recentDeals },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("deals").select("value, stage"),
    supabase
      .from("deals")
      .select("*, contact:contacts(first_name, last_name), company:companies(name)")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("total, status")
      .in("status", ["sent", "paid"]),
  ]);

  const pipeline = (deals ?? []).reduce(
    (acc, d) => {
      acc.total += d.value ?? 0;
      if (d.stage === "won") acc.won += d.value ?? 0;
      return acc;
    },
    { total: 0, won: 0 }
  );

  const revenue = (invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((acc, i) => acc + (i.total ?? 0), 0);

  return { contactsCount, companiesCount, pipeline, revenue, recentDeals };
}

const stageBadgeMap: Record<string, React.ComponentProps<typeof Badge>["variant"]> = {
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

  const { contactsCount, companiesCount, pipeline, revenue, recentDeals } =
    await getDashboardStats(supabase);

  const stats = [
    {
      title: "Contacts",
      value: contactsCount ?? 0,
      icon: Users,
      href: "/dashboard/contacts",
      color: "text-[#818CF8]",
      bg: "bg-[#6366F1]/10",
    },
    {
      title: "Entreprises",
      value: companiesCount ?? 0,
      icon: Building2,
      href: "/dashboard/companies",
      color: "text-[#60A5FA]",
      bg: "bg-[#3B82F6]/10",
    },
    {
      title: "Pipeline total",
      value: formatCurrency(pipeline.total),
      icon: TrendingUp,
      href: "/dashboard/pipeline",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      title: "CA encaissé",
      value: formatCurrency(revenue),
      icon: FileText,
      href: "/dashboard/billing",
      color: "text-[#4ADE80]",
      bg: "bg-[#22C55E]/10",
    },
  ];

  return (
    <div className="flex flex-col flex-1">
      <Header title="Tableau de bord" />

      <div className="flex-1 p-6 space-y-6 animate-fade-in">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Bonjour {firstName}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Voici un aperçu de votre activité.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:shadow-card-hover hover:border-[var(--border)] transition-all cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`h-9 w-9 flex items-center justify-center ${stat.bg}`}>
                        <Icon className={`h-4 w-4 ${stat.color}`} />
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.title}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
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
                Aucun deal pour l'instant.{" "}
                <Link href="/dashboard/pipeline" className="text-accent hover:underline">
                  Créer le premier
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentDeals.map((deal: any) => (
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
