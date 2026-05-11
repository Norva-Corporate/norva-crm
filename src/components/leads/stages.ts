import type { LeadPipelineStage } from "@/lib/actions/leads";

export interface LeadStageDef {
  key: LeadPipelineStage;
  label: string;
  accent: string;
  description: string;
}

export const LEAD_STAGES: LeadStageDef[] = [
  {
    key: "brut",
    label: "Brut",
    accent: "#64748B",
    description: "Arrivé mais pas encore vérifié",
  },
  {
    key: "verified",
    label: "Vérifié",
    accent: "#3B82F6",
    description: "Toutes les données contrôlées",
  },
  {
    key: "to_contact",
    label: "À contacter",
    accent: "#F59E0B",
    description: "Priorisé pour cette semaine",
  },
  {
    key: "contacted",
    label: "Contacté",
    accent: "#A855F7",
    description: "Premier contact envoyé",
  },
  {
    key: "in_discussion",
    label: "En discussion",
    accent: "#22C55E",
    description: "Le prospect a répondu",
  },
];

export function getLeadStage(key: LeadPipelineStage): LeadStageDef {
  return LEAD_STAGES.find((s) => s.key === key) ?? LEAD_STAGES[0];
}

export const LEAD_STAGE_KEYS = LEAD_STAGES.map((s) => s.key);

// ============================================================
// Quality helpers
// ============================================================
export type QualityLevel = "green" | "orange" | "red" | null;

export function getQualityLevel(score: number | null): QualityLevel {
  if (score == null) return null;
  if (score >= 80) return "green";
  if (score >= 40) return "orange";
  return "red";
}

export const QUALITY_COLOR: Record<NonNullable<QualityLevel>, string> = {
  green: "#22C55E",
  orange: "#F59E0B",
  red: "#EF4444",
};

export const QUALITY_LABEL: Record<NonNullable<QualityLevel>, string> = {
  green: "Données fiables",
  orange: "Vérif partielle",
  red: "Données faibles",
};

/**
 * Option C — suggestion auto "à attaquer" :
 * lead en `verified` avec quality_score >= 80.
 * Le drag reste manuel mais on affiche un badge ⭐.
 */
export function isRecommendedForContact(
  stage: LeadPipelineStage,
  qualityScore: number | null
): boolean {
  return stage === "verified" && qualityScore != null && qualityScore >= 80;
}

// ============================================================
// Stagnation — détecter les leads qui dorment dans une colonne
// ============================================================
export type StagnationLevel = "warn" | "alert" | null;

/**
 * Combien de jours un lead est resté dans son stage actuel.
 * Skip pour `brut` (= "non traité", pas "stagnant").
 *
 * - null : pas de badge (< 3 jours OU stage='brut')
 * - 'warn' : 3-7 jours dans le stage (jaune)
 * - 'alert' : > 7 jours dans le stage (rouge)
 */
export function getStagnationLevel(
  stage: LeadPipelineStage,
  stageUpdatedAt: string | null
): StagnationLevel {
  if (stage === "brut") return null;
  if (!stageUpdatedAt) return null;
  const updated = new Date(stageUpdatedAt).getTime();
  if (Number.isNaN(updated)) return null;
  const days = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  if (days < 3) return null;
  if (days < 7) return "warn";
  return "alert";
}

export const STAGNATION_COLOR: Record<NonNullable<StagnationLevel>, string> = {
  warn: "#F59E0B",
  alert: "#EF4444",
};

export function stagnationDays(stageUpdatedAt: string | null): number {
  if (!stageUpdatedAt) return 0;
  const updated = new Date(stageUpdatedAt).getTime();
  if (Number.isNaN(updated)) return 0;
  return Math.floor((Date.now() - updated) / (1000 * 60 * 60 * 24));
}
