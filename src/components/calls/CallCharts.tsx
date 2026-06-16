import React from "react";
import { REACHABILITY, REACHABILITY_COLORS } from "@/lib/call-outcomes";
import type { CallStats } from "@/lib/actions/calls";

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}

function Rate({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-muted-foreground">—</span>;
  const color = rate >= 50 ? "#22C55E" : rate >= 25 ? "#F59E0B" : "#EF4444";
  return (
    <span className="font-mono font-medium" style={{ color }}>
      {rate}%
    </span>
  );
}

// ============================================================
// Répartition des appels par joignabilité
// ============================================================
export function ReachabilityBreakdown({ stats }: { stats: CallStats }) {
  const rows: { key: keyof typeof REACHABILITY; value: number }[] = [
    { key: "repondu", value: stats.repondus },
    { key: "messagerie", value: stats.messagerie },
    { key: "pas_de_reponse", value: stats.pasDeReponse },
    { key: "numero_invalide", value: stats.numeroInvalide },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground">{REACHABILITY[r.key]}</span>
            <span className="font-mono text-muted-foreground shrink-0">
              {r.value}
              <span className="text-muted-foreground/60">
                {" "}
                · {Math.round(pct(r.value, stats.appels))}%
              </span>
            </span>
          </div>
          <div className="h-2.5 bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${pct(r.value, max)}%`,
                backgroundColor: REACHABILITY_COLORS[r.key],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Par commercial — appels, taux de réponse, RDV, signés
// ============================================================
export function CallRepBreakdown({ data }: { data: CallStats["byRep"] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Aucun appel attribué à un commercial.
      </p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.appels));
  return (
    <div className="space-y-3">
      {data.map((r) => (
        <div key={r.repId} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-foreground">
              {r.accent && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: r.accent }}
                />
              )}
              {r.name}
            </span>
            <span className="font-mono text-muted-foreground">
              {r.appels} appels · réponse <Rate rate={r.tauxReponse} /> ·{" "}
              {r.rdv} RDV · {r.signes} signé{r.signes > 1 ? "s" : ""}
            </span>
          </div>
          <div className="h-2 bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${pct(r.appels, max)}%`,
                backgroundColor: r.accent ?? "#3B7BF5",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Récap chronologique — tableau partagé (période la plus récente en haut)
// ============================================================
interface RecapRow {
  key: string;
  label: string;
  appels: number;
  repondus: number;
  sansReponse: number;
  rdv: number;
  aRappeler: number;
  devisAEnvoyer: number;
  devisEnvoyes: number;
  signes: number;
}

const RECAP_COLS: { key: keyof RecapRow; label: string }[] = [
  { key: "appels", label: "Appels" },
  { key: "repondus", label: "Répondus" },
  { key: "sansReponse", label: "Sans rép." },
  { key: "rdv", label: "RDV" },
  { key: "aRappeler", label: "À rappeler" },
  { key: "devisAEnvoyer", label: "Devis à env." },
  { key: "devisEnvoyes", label: "Devis env." },
  { key: "signes", label: "Signés" },
];

function RecapTable({
  firstColLabel,
  rows,
  emptyText,
}: {
  firstColLabel: string;
  rows: RecapRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left font-mono uppercase tracking-wide text-[10px] text-muted-foreground py-2 pr-3">
              {firstColLabel}
            </th>
            {RECAP_COLS.map((c) => (
              <th
                key={c.key}
                className="text-right font-mono uppercase tracking-wide text-[10px] text-muted-foreground py-2 px-2 whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
            <th className="text-right font-mono uppercase tracking-wide text-[10px] text-muted-foreground py-2 pl-2">
              Taux rép.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className="border-b border-[var(--border)] last:border-0"
            >
              <td className="py-2 pr-3 font-mono text-foreground whitespace-nowrap">
                {r.label}
              </td>
              {RECAP_COLS.map((c) => (
                <td
                  key={c.key}
                  className="text-right py-2 px-2 font-mono tabular-nums text-foreground"
                >
                  {r[c.key]}
                </td>
              ))}
              <td className="text-right py-2 pl-2 font-mono tabular-nums">
                <Rate
                  rate={
                    r.appels > 0
                      ? Math.round((r.repondus / r.appels) * 100)
                      : null
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeeklyRecapTable({ data }: { data: CallStats["weekly"] }) {
  return (
    <RecapTable
      firstColLabel="Semaine"
      emptyText="Aucune semaine d'activité sur la période."
      rows={data.map((w) => ({ ...w, key: w.week, label: formatWeek(w.week) }))}
    />
  );
}

export function DailyRecapTable({ data }: { data: CallStats["daily"] }) {
  return (
    <RecapTable
      firstColLabel="Jour"
      emptyText="Aucun jour d'activité sur la période."
      rows={data.map((d) => ({ ...d, key: d.day, label: formatDay(d.day) }))}
    />
  );
}

/** 'YYYY-MM-DD' (lundi) → 'sem. du JJ/MM'. */
function formatWeek(week: string): string {
  const [y, m, d] = week.split("-");
  if (!y || !m || !d) return week;
  return `sem. du ${d}/${m}`;
}

const WEEKDAYS_FR = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** 'YYYY-MM-DD' → 'lun. JJ/MM'. */
function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  if (!y || !m || !d) return day;
  const wd = WEEKDAYS_FR[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? "";
  return `${wd} ${d}/${m}`;
}

// ============================================================
// Empty state
// ============================================================
export function ProspectionEmptyState() {
  return (
    <div className="border border-dashed border-[var(--border)] bg-[var(--surface)] py-16 text-center">
      <p className="text-sm text-foreground">Aucun appel enregistré</p>
      <p className="text-xs text-muted-foreground mt-1">
        Enregistrez vos appels depuis la fiche d&apos;un lead (Pipeline) — les
        KPI de prospection apparaîtront ici.
      </p>
    </div>
  );
}
