// ============================================================
// Catalogue des objections — source de vérité unique
// ============================================================
// Consommé par : le logger d'objection (fiche lead/contact), l'historique,
// le dashboard de stats, et le raccourci depuis la Trame RDV 1.
// La table public.objection_logs stocke objection_id (clé ci-dessous),
// objection_label + stage étant dérivés server-side depuis ce catalogue.
// ============================================================

export const OBJECTION_CATALOG = {
  // Cold Call
  tps:        { label: "J'ai pas le temps",        stage: "coldcall" },
  mail:       { label: "Envoyez un mail",          stage: "coldcall" },
  nope:       { label: "Ça m'intéresse pas",       stage: "coldcall" },
  site:       { label: "J'ai déjà un site",        stage: "coldcall" },
  bao:        { label: "Bouche-à-oreille",         stage: "coldcall" },
  deborde:    { label: "Débordé",                  stage: "coldcall" },
  rappel:     { label: "Rappelez plus tard",       stage: "coldcall" },
  combien:    { label: "C'est combien ?",          stage: "coldcall" },
  // Audit · RDV 1
  reflechir:  { label: "Je vais réfléchir",        stage: "audit" },
  associe:    { label: "En parler à l'associé",    stage: "audit" },
  cher:       { label: "Trop cher",                stage: "audit" },
  neveu:      { label: "Mon neveu peut le faire",  stage: "audit" },
  pourquoi:   { label: "Pourquoi vous ?",          stage: "audit" },
  seo:        { label: "SEO garanti ?",            stage: "audit" },
  duree:      { label: "Combien de temps ?",       stage: "audit" },
  essaye:     { label: "Déjà essayé",              stage: "audit" },
  // Annexes
  tarifmail:  { label: "Tarifs par mail",          stage: "annexes" },
  reseaux:    { label: "Les réseaux suffisent",    stage: "annexes" },
  petit:      { label: "Trop petit",               stage: "annexes" },
  arnaque:    { label: "Déjà arnaqué",             stage: "annexes" },
  recontacte: { label: "Je vous recontacte",       stage: "annexes" },
} as const;

export const STAGES = {
  coldcall: "Cold Call",
  audit: "Audit · R1",
  annexes: "Annexes",
} as const;

export const OUTCOMES = {
  accepte: "Accepte",
  hesite: "Hésite",
  refuse: "Refuse",
} as const;

// Couleurs des issues (boutons + pastilles historique + barres dashboard).
export const OUTCOME_COLORS: Record<ObjectionOutcome, string> = {
  accepte: "#3BD17A",
  hesite: "#F5B23B",
  refuse: "#F55B5B",
};

export type ObjectionId = keyof typeof OBJECTION_CATALOG;
export type ObjectionStage = keyof typeof STAGES;
export type ObjectionOutcome = keyof typeof OUTCOMES;
export type ObjectionEntityType = "lead_import" | "contact";

export function isObjectionId(id: string): id is ObjectionId {
  return Object.prototype.hasOwnProperty.call(OBJECTION_CATALOG, id);
}

export function getObjection(id: string) {
  return isObjectionId(id) ? OBJECTION_CATALOG[id] : null;
}

export function objectionLabel(id: string): string {
  return getObjection(id)?.label ?? id;
}

/** Ordre canonique des étapes (sélecteur groupé, dashboard). */
export const STAGE_ORDER: ObjectionStage[] = ["coldcall", "audit", "annexes"];

/** Catalogue regroupé par étape — pour le <Select> groupé du logger. */
export function objectionsByStage(): {
  stage: ObjectionStage;
  label: string;
  items: { id: ObjectionId; label: string }[];
}[] {
  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGES[stage],
    items: (Object.keys(OBJECTION_CATALOG) as ObjectionId[])
      .filter((id) => OBJECTION_CATALOG[id].stage === stage)
      .map((id) => ({ id, label: OBJECTION_CATALOG[id].label })),
  }));
}
