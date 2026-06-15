import React from "react";
import { OUTCOME_COLORS, OUTCOMES } from "@/lib/objections";
import type { ObjectionStats } from "@/lib/actions/objections";

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}

// ============================================================
// Légende des issues (réutilisée sous les barres)
// ============================================================
export function OutcomeLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
      {(Object.keys(OUTCOMES) as (keyof typeof OUTCOMES)[]).map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5"
            style={{ backgroundColor: OUTCOME_COLORS[o] }}
          />
          {OUTCOMES[o]}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// Objections les plus fréquentes — barres empilées par issue
// ============================================================
export function StackedObjectionBars({
  data,
}: {
  data: ObjectionStats["byObjection"];
}) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.id} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground truncate pr-2">{d.label}</span>
            <span className="font-mono text-muted-foreground shrink-0">
              {d.total}
            </span>
          </div>
          <div className="h-2.5 bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full flex"
              style={{ width: `${pct(d.total, max)}%` }}
            >
              {(["accepte", "hesite", "refuse"] as const).map((o) =>
                d[o] > 0 ? (
                  <div
                    key={o}
                    className="h-full"
                    style={{
                      width: `${pct(d[o], d.total)}%`,
                      backgroundColor: OUTCOME_COLORS[o],
                    }}
                    title={`${OUTCOMES[o]} : ${d[o]}`}
                  />
                ) : null
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Par étape — Cold Call / Audit / Annexes + % closing
// ============================================================
export function StageBreakdown({
  data,
}: {
  data: ObjectionStats["byStage"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {data.map((s) => (
        <div
          key={s.stage}
          className="border border-[var(--border)] bg-[var(--surface)] p-3"
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
            {s.label}
          </p>
          <p className="text-xl font-bold text-foreground mt-1 font-mono tabular-nums">
            {s.total}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            objections loggées
          </p>
          <p className="text-xs mt-2">
            <span className="text-muted-foreground">Closing&nbsp;: </span>
            <ClosingRate rate={s.closingRate} />
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Par commercial — total + % closing + barre
// ============================================================
export function RepBreakdown({ data }: { data: ObjectionStats["byRep"] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Aucune objection attribuée à un commercial.
      </p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.total));
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
              {r.total} · closing <ClosingRate rate={r.closingRate} />
            </span>
          </div>
          <div className="h-2 bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${pct(r.total, max)}%`,
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
// Par pain identifié — barres triées
// ============================================================
export function PainBreakdown({ data }: { data: ObjectionStats["byPain"] }) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Aucun pain renseigné sur les objections loggées.
      </p>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="space-y-2">
      {data.map((p) => (
        <div key={p.painId} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-foreground truncate pr-2">
              {p.painId}
            </span>
            <span className="font-mono text-muted-foreground shrink-0">
              {p.total}
            </span>
          </div>
          <div className="h-2 bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full bg-accent"
              style={{ width: `${pct(p.total, max)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ClosingRate({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-muted-foreground">—</span>;
  const color =
    rate >= 50 ? "#22C55E" : rate >= 25 ? "#F59E0B" : "#EF4444";
  return (
    <span className="font-mono font-medium" style={{ color }}>
      {rate}%
    </span>
  );
}

// ============================================================
// Empty state
// ============================================================
export function ObjectionsEmptyState() {
  return (
    <div className="border border-dashed border-[var(--border)] bg-[var(--surface)] py-16 text-center">
      <p className="text-sm text-foreground">Aucune objection loggée</p>
      <p className="text-xs text-muted-foreground mt-1">
        Loggez des objections depuis la fiche d&apos;un lead (Pipeline) — les
        stats apparaîtront ici.
      </p>
    </div>
  );
}
