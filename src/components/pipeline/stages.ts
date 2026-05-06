import type { DealStage } from "@/types";

export interface StageDef {
  key: DealStage;
  label: string;
  /** Couleur d'accent (hex) — utilisé pour les badges et bordures */
  accent: string;
  /** Variant du Badge */
  badgeVariant: "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost";
}

export const STAGES: StageDef[] = [
  { key: "prospect", label: "Prospect", accent: "#6366F1", badgeVariant: "prospect" },
  { key: "qualified", label: "Qualifié", accent: "#3B82F6", badgeVariant: "qualified" },
  { key: "proposal", label: "Devis envoyé", accent: "#F59E0B", badgeVariant: "proposal" },
  { key: "negotiation", label: "Négociation", accent: "#F97316", badgeVariant: "negotiation" },
  { key: "won", label: "Gagné", accent: "#22C55E", badgeVariant: "won" },
  { key: "lost", label: "Perdu", accent: "#EF4444", badgeVariant: "lost" },
];

export function getStage(key: DealStage): StageDef {
  return STAGES.find((s) => s.key === key) ?? STAGES[0];
}

/** Stages "ouverts" (qui comptent dans le pipeline value) */
export const OPEN_STAGES: DealStage[] = [
  "prospect",
  "qualified",
  "proposal",
  "negotiation",
];

/**
 * Couleur de priorité selon le délai restant avant la date de closing.
 * - > 30j : vert (success)
 * - 15-30j : orange (warning)
 * - < 15j : rouge (destructive)
 * - aucune date : null
 */
export type PriorityLevel = "high" | "medium" | "low" | null;

export function getPriority(expectedClose: string | null | undefined): PriorityLevel {
  if (!expectedClose) return null;
  const target = new Date(expectedClose);
  if (isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 15) return "high";
  if (diffDays <= 30) return "medium";
  return "low";
}

export const PRIORITY_COLOR: Record<NonNullable<PriorityLevel>, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#22C55E",
};

export const PRIORITY_LABEL: Record<NonNullable<PriorityLevel>, string> = {
  high: "< 15 jours",
  medium: "15–30 jours",
  low: "> 30 jours",
};
