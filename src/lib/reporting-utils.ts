// Helpers sync pour le reporting — séparés de `lib/actions/reporting.ts`
// qui est `"use server"` (toutes les exports doivent y être async).
// Réutilisables côté server pages et components.

import type { ReportFilters, ReportPeriod } from "@/lib/actions/reporting";

export function parseReportFilters(searchParams: {
  period?: string;
  owner?: string;
}): ReportFilters {
  const validPeriods: ReportPeriod[] = ["30d", "90d", "ytd", "12m"];
  const period =
    searchParams.period &&
    validPeriods.includes(searchParams.period as ReportPeriod)
      ? (searchParams.period as ReportPeriod)
      : "ytd";
  const ownerId =
    searchParams.owner && searchParams.owner !== "all"
      ? searchParams.owner
      : null;
  return { period, ownerId };
}

export function getPeriodLabel(period: ReportPeriod): string {
  switch (period) {
    case "30d":
      return "30 jours";
    case "90d":
      return "90 jours";
    case "ytd":
      return "Année en cours";
    case "12m":
      return "12 derniers mois";
  }
}
