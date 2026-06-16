"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PERIODS: { value: string; label: string }[] = [
  { value: "30d", label: "30 j" },
  { value: "90d", label: "90 j" },
  { value: "all", label: "Tout" },
];

export interface ToolbarRep {
  id: string;
  shortName: string;
  accent: string;
}

/**
 * Toolbar dashboard prospection : période (30j/90j/Tout) + commercial.
 * État stocké dans l'URL (?period=&rep=<profileId>). La page server lit ces
 * params et les passe à getCallStats. (Calqué sur ObjectionsToolbar.)
 */
export function ProspectionToolbar({ reps }: { reps: ToolbarRep[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") ?? "all";
  const currentRep = searchParams.get("rep") ?? "all";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
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

      {/* Commercial */}
      <div className="inline-flex border border-[var(--border)] bg-[var(--surface)] p-0.5">
        <button
          type="button"
          onClick={() => setParam("rep", "all")}
          className={cn(
            "h-7 px-2.5 text-xs transition-colors",
            currentRep === "all"
              ? "bg-accent/15 text-accent"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Tous
        </button>
        {reps.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setParam("rep", r.id)}
            className="h-7 px-2.5 text-xs transition-colors inline-flex items-center gap-1.5"
            style={
              currentRep === r.id
                ? { color: r.accent, background: `${r.accent}20` }
                : undefined
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: r.accent }}
            />
            {r.shortName}
          </button>
        ))}
      </div>
    </div>
  );
}
