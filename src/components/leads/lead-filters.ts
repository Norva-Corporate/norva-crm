import type {
  LeadEmailVerified,
  LeadWithDedup,
} from "@/lib/actions/leads";

// ============================================================
// Filtres et tri pour la vue Leads (kanban + liste)
// ============================================================

export type QualityFilter = "all" | "green" | "orange" | "red";
export type EmailFilter = "all" | LeadEmailVerified;
export type EffectifFilter = "all" | "small" | "medium" | "large" | "unknown";
export type LeadSortBy =
  | "recent"
  | "quality_desc"
  | "imported_oldest"
  | "stagnation_desc";

export interface LeadFilters {
  quality: QualityFilter;
  email: EmailFilter;
  effectif: EffectifFilter;
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  quality: "all",
  email: "all",
  effectif: "all",
};

export const DEFAULT_SORT: LeadSortBy = "recent";

/**
 * Extrait la tranche d'effectif depuis raw_payload.
 * Source : code Pappers `tranche_effectif_salarie` (cf. skill enrichment-gouv).
 */
export function getEffectifBucket(
  rawPayload: Record<string, unknown> | null
): EffectifFilter {
  if (!rawPayload) return "unknown";
  const code = (rawPayload as Record<string, unknown>).tranche_effectif_salarie;
  if (typeof code !== "string") return "unknown";
  if (["00", "01", "02", "03"].includes(code)) return "small";
  if (["11", "12"].includes(code)) return "medium";
  if (
    ["21", "22", "31", "32", "41", "51", "52", "53", "54"].includes(code)
  )
    return "large";
  return "unknown";
}

function getQualityBucket(
  score: number | null
): "green" | "orange" | "red" | null {
  if (score == null) return null;
  if (score >= 80) return "green";
  if (score >= 40) return "orange";
  return "red";
}

export function matchesFilters(
  lead: LeadWithDedup,
  filters: LeadFilters
): boolean {
  if (filters.quality !== "all") {
    const bucket = getQualityBucket(lead.quality_score);
    if (bucket !== filters.quality) return false;
  }
  if (filters.email !== "all" && lead.email_verified !== filters.email) {
    return false;
  }
  if (filters.effectif !== "all") {
    const bucket = getEffectifBucket(lead.raw_payload);
    if (bucket !== filters.effectif) return false;
  }
  return true;
}

export function sortLeads(
  leads: LeadWithDedup[],
  sortBy: LeadSortBy
): LeadWithDedup[] {
  const sorted = [...leads];
  sorted.sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return (
          new Date(b.imported_at).getTime() -
          new Date(a.imported_at).getTime()
        );
      case "quality_desc": {
        const aq = a.quality_score ?? -1;
        const bq = b.quality_score ?? -1;
        return bq - aq;
      }
      case "imported_oldest":
        return (
          new Date(a.imported_at).getTime() -
          new Date(b.imported_at).getTime()
        );
      case "stagnation_desc":
        // Les plus vieux dans leur stage d'abord (stage_updated_at ascendant)
        return (
          new Date(a.stage_updated_at).getTime() -
          new Date(b.stage_updated_at).getTime()
        );
    }
  });
  return sorted;
}

export function countActiveFilters(filters: LeadFilters): number {
  let n = 0;
  if (filters.quality !== "all") n++;
  if (filters.email !== "all") n++;
  if (filters.effectif !== "all") n++;
  return n;
}

// ============================================================
// Labels pour l'UI
// ============================================================

export const QUALITY_FILTER_LABELS: Record<QualityFilter, string> = {
  all: "Toutes",
  green: "Élevée (≥80)",
  orange: "Moyenne (40-79)",
  red: "Faible (<40)",
};

export const EMAIL_FILTER_LABELS: Record<EmailFilter, string> = {
  all: "Tous les emails",
  valid: "Email vérifié",
  risky: "Email risqué",
  invalid: "Email invalide",
  unverified: "Non vérifié",
};

export const EFFECTIF_FILTER_LABELS: Record<EffectifFilter, string> = {
  all: "Toutes tailles",
  small: "0-9 salariés",
  medium: "10-49 salariés",
  large: "50+ salariés",
  unknown: "Effectif inconnu",
};

export const SORT_LABELS: Record<LeadSortBy, string> = {
  recent: "Plus récents",
  quality_desc: "Meilleure qualité",
  imported_oldest: "Plus anciens",
  stagnation_desc: "Plus stagnants",
};
