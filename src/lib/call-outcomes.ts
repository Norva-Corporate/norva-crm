// ============================================================
// Catalogue des issues d'appel — source de vérité unique (cold call)
// ============================================================
// Consommé par : le CallLogger (fiche lead/contact), l'historique des appels,
// et le dashboard prospection. La table public.call_logs stocke `reachability`
// (joignabilité) + `result` (résultat de l'échange) ; les libellés sont dérivés
// de ce catalogue (côté serveur ET côté UI), jamais stockés en dur.
//
// Modèle 2 axes (validé) :
//   - reachability : a-t-on joint quelqu'un ? Toujours renseignée.
//   - result       : qu'est-il ressorti de l'échange ? Uniquement si répondu.
// Calqué sur le catalogue d'objections (src/lib/objections.ts).
// ============================================================

export const REACHABILITY = {
  repondu: "Répondu",
  messagerie: "Messagerie",
  pas_de_reponse: "Pas de réponse",
  numero_invalide: "Numéro invalide",
} as const;

export const RESULTS = {
  rdv: "RDV obtenu",
  rappel: "À rappeler",
  devis: "Devis à envoyer",
  pas_interesse: "Pas intéressé",
} as const;

// Couleurs (boutons logger + pastilles historique + barres dashboard).
export const REACHABILITY_COLORS: Record<CallReachability, string> = {
  repondu: "#3BD17A",
  messagerie: "#F5B23B",
  pas_de_reponse: "#8A99B8",
  numero_invalide: "#F55B5B",
};

export const RESULT_COLORS: Record<CallResult, string> = {
  rdv: "#3B7BF5",
  rappel: "#F5B23B",
  devis: "#A855F7",
  pas_interesse: "#F55B5B",
};

export type CallReachability = keyof typeof REACHABILITY;
export type CallResult = keyof typeof RESULTS;
export type CallEntityType = "lead_import" | "contact";

/** Joignabilité comptée comme « appel réellement décroché ». */
export const ANSWERED: CallReachability = "repondu";

/** Joignabilités comptées comme « sans réponse » (messagerie incluse). */
export const NO_ANSWER_REACHABILITY: CallReachability[] = [
  "messagerie",
  "pas_de_reponse",
  "numero_invalide",
];

export const REACHABILITY_KEYS = Object.keys(REACHABILITY) as CallReachability[];
export const RESULT_KEYS = Object.keys(RESULTS) as CallResult[];

export function isReachability(v: string): v is CallReachability {
  return Object.prototype.hasOwnProperty.call(REACHABILITY, v);
}

export function isResult(v: string): v is CallResult {
  return Object.prototype.hasOwnProperty.call(RESULTS, v);
}

export function getReachabilityLabel(v: string | null | undefined): string {
  return v && isReachability(v) ? REACHABILITY[v] : "—";
}

export function getResultLabel(v: string | null | undefined): string {
  return v && isResult(v) ? RESULTS[v] : "—";
}
