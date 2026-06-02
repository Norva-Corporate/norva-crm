"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PERIODS: { value: string; label: string }[] = [
  { value: "30d", label: "30 j" },
  { value: "90d", label: "90 j" },
  { value: "ytd", label: "YTD" },
  { value: "12m", label: "12 mois" },
];

/**
 * Toolbar reporting : sélecteur période + sélecteur owner.
 * État stocké dans l'URL (?period=ytd&owner=<profileId|all>). Le server
 * page lit ces params dans `searchParams` et les passe à getReportData.
 */
export function ReportingToolbar({
  profiles,
}: {
  profiles: { id: string; full_name: string | null; email: string | null }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") ?? "ytd";
  const currentOwner = searchParams.get("owner") ?? "all";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "ytd") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(
      `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
      { scroll: false }
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Période */}
      <div className="inline-flex border border-[var(--border)] bg-[var(--surface)] p-0.5">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setParam("period", p.value)}
            className={cn(
              "h-7 px-2.5 text-xs transition-colors",
              currentPeriod === p.value
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Owner */}
      <div className="inline-flex border border-[var(--border)] bg-[var(--surface)] p-0.5">
        <button
          type="button"
          onClick={() => setParam("owner", "all")}
          className={cn(
            "h-7 px-2.5 text-xs transition-colors",
            currentOwner === "all"
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Tous
        </button>
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setParam("owner", p.id)}
            className={cn(
              "h-7 px-2.5 text-xs transition-colors",
              currentOwner === p.id
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.full_name?.split(" ")[0] ?? p.email}
          </button>
        ))}
      </div>
    </div>
  );
}
