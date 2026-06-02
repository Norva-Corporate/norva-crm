"use client";
import React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Monthly bars — 12 months, paid revenue + invoiced
// ============================================================
export function MonthlyRevenueChart({
  data,
}: {
  data: { label: string; revenue: number; invoiced: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.invoiced));
  const width = 720;
  const barWidth = (width - 40) / data.length;
  const height = 220;
  const innerHeight = height - 40;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ minWidth: 360 }}
      >
        <line
          x1={20}
          y1={innerHeight}
          x2={width - 20}
          y2={innerHeight}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const x = 20 + i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          const invoicedH = (d.invoiced / max) * (innerHeight - 20);
          const revenueH = (d.revenue / max) * (innerHeight - 20);
          return (
            <g key={d.label + i}>
              <title>
                {d.label} · Facturé {Math.round(d.invoiced)} € · Encaissé{" "}
                {Math.round(d.revenue)} €
              </title>
              <rect
                x={x}
                y={innerHeight - invoicedH}
                width={w}
                height={invoicedH}
                fill="rgba(59,123,245,0.2)"
                stroke="rgba(59,123,245,0.4)"
                strokeWidth={1}
              />
              <rect
                x={x}
                y={innerHeight - revenueH}
                width={w}
                height={revenueH}
                fill="#22C55E"
              />
              <text
                x={x + w / 2}
                y={height - 12}
                fontSize={9}
                textAnchor="middle"
                fill="var(--muted-foreground)"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-[#22C55E]" /> Encaissé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-[rgba(59,123,245,0.3)] border border-[rgba(59,123,245,0.5)]" />{" "}
          Facturé
        </span>
      </div>
    </div>
  );
}

// ============================================================
// Horizontal bar — pipeline by stage (value)
// ============================================================
const STAGE_LABELS: Record<string, string> = {
  discussion: "Discussion",
  proposal: "Devis",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};

const STAGE_COLORS: Record<string, string> = {
  discussion: "#6366F1",
  proposal: "#F59E0B",
  negotiation: "#F97316",
  won: "#22C55E",
  lost: "#EF4444",
};

export function PipelineByStageChart({
  data,
}: {
  data: { stage: string; count: number; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={d.stage} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">
                {STAGE_LABELS[d.stage] ?? d.stage}{" "}
                <span className="text-muted-foreground">({d.count})</span>
              </span>
              <span className="font-mono text-muted-foreground">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                }).format(d.value)}
              </span>
            </div>
            <div className="h-2 bg-[var(--muted)] rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: STAGE_COLORS[d.stage] ?? "#3B7BF5",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Funnel — conversion par stage (counts)
// ============================================================
/**
 * Funnel lead → qualified → deal → won (4 étapes verticales).
 * Affiche les chiffres absolus + le taux de drop entre étapes.
 * Couleurs : bleu pour leads, jaune pour qualified, vert pour deals
 * (created + won), pour rester cohérent avec la sémantique du CRM.
 */
export function LeadDealFunnel({
  data,
}: {
  data: {
    leads_imported: number;
    leads_qualified: number;
    deals_created: number;
    deals_won: number;
  };
}) {
  const steps = [
    { key: "leads_imported", label: "Leads importés", value: data.leads_imported, color: "#3B82F6" },
    { key: "leads_qualified", label: "Leads qualifiés", value: data.leads_qualified, color: "#F59E0B" },
    { key: "deals_created", label: "Deals créés", value: data.deals_created, color: "#22C55E" },
    { key: "deals_won", label: "Deals gagnés", value: data.deals_won, color: "#10B981" },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate =
          prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <span className="text-xs text-foreground w-28 shrink-0">
              {s.label}
            </span>
            <div className="flex-1 h-6 bg-[var(--muted)] rounded-sm overflow-hidden relative">
              <div
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: s.color, opacity: 0.85 }}
              />
              <span className="absolute inset-0 flex items-center justify-end px-2 text-[11px] text-foreground font-mono">
                {s.value}
              </span>
            </div>
            <span
              className={cn(
                "text-[10px] w-14 text-right font-mono",
                rate === null
                  ? "text-muted-foreground"
                  : rate < 30
                  ? "text-destructive"
                  : rate < 60
                  ? "text-[#F59E0B]"
                  : "text-[#22C55E]"
              )}
            >
              {rate === null ? "" : `${rate}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ConversionFunnel({
  data,
}: {
  data: { stage: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const order = [
    "discussion",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ];
  const sorted = order.map((s) => data.find((d) => d.stage === s)).filter(
    Boolean
  ) as { stage: string; count: number }[];

  return (
    <div className="space-y-1.5">
      {sorted.map((d, i) => {
        const pct = (d.count / max) * 100;
        const previous = i > 0 ? sorted[i - 1].count : null;
        const dropPct =
          previous && previous > 0
            ? Math.round((1 - d.count / previous) * 100)
            : null;
        return (
          <div key={d.stage} className="flex items-center gap-3">
            <span className="text-xs text-foreground w-24 shrink-0">
              {STAGE_LABELS[d.stage] ?? d.stage}
            </span>
            <div className="flex-1 h-6 bg-[var(--muted)] rounded-sm overflow-hidden relative">
              <div
                className="h-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: STAGE_COLORS[d.stage] ?? "#3B7BF5",
                  opacity: 0.85,
                }}
              />
              <span className="absolute inset-0 flex items-center justify-end px-2 text-[11px] text-foreground font-mono">
                {d.count}
              </span>
            </div>
            <span
              className={cn(
                "text-[10px] w-12 text-right font-mono",
                dropPct === null
                  ? "text-muted-foreground"
                  : dropPct > 50
                  ? "text-destructive"
                  : dropPct > 20
                  ? "text-[#F59E0B]"
                  : "text-muted-foreground"
              )}
            >
              {dropPct === null ? "" : `−${dropPct}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
