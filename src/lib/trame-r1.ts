// ============================================================
// Trame RDV 1 — données + structure des 7 phases + normalisation
// ============================================================
// Squelette constant, contenu ciblé qui change selon secteur + pain.
// Les slots {lieu}/{metier} viennent de SECTEURS ; les blocs ciblés
// (decouverte/maquette/perte/closing) viennent de PAIN_CONTENT.
// Tout le contenu prospect-facing est en vouvoiement.
// ============================================================

export const SECTEURS = {
  garage:   { lieu: "votre garage",        metier: "garagiste" },
  btp:      { lieu: "votre activité",       metier: "artisan" },
  sante:    { lieu: "votre cabinet",        metier: "kiné" },
  commerce: { lieu: "votre commerce",       metier: "commerçant" },
  coiffure: { lieu: "votre salon",          metier: "coiffeur" },
  liberal:  { lieu: "votre cabinet",        metier: "professionnel" },
  resto:    { lieu: "votre établissement",  metier: "restaurateur" },
  autre:    { lieu: "votre activité",       metier: "professionnel" },
} as const;

export const PAIN_CONTENT = {
  no_website: {
    decouverte: "« Quand quelqu'un entend parler de vous et tape votre nom sur Google, il tombe sur quoi aujourd'hui ? »",
    maquette:   "Insistez sur l'existence et la crédibilité : « voilà ce que verrait un client qui vous cherche ». Vous captez enfin les recherches locales.",
    perte:      "Aujourd'hui, chaque personne qui vous cherche sur Google ne trouve rien — ou trouve un concurrent. Ces clients-là, vous les perdez sans le savoir.",
    closing:    "On vous met sur la carte, là où vos clients cherchent déjà — en ligne en 1 à 2 semaines.",
  },
  outdated_site: {
    decouverte: "« Votre site actuel, il date de quand ? Vous avez l'impression qu'il vous ramène des clients, ou qu'il est juste là pour exister ? »",
    maquette:   "Jouez l'avant / après : modernité, vitesse, HTTPS. Le contraste fait le travail à votre place.",
    perte:      "Un site daté et non sécurisé, Google le déclasse et le visiteur fuit. Vous payez un hébergement pour repousser des clients.",
    closing:    "On repart sur une base propre, rapide et sécurisée — et on récupère le terrain perdu sur Google.",
  },
  no_online_booking: {
    decouverte: "« Combien de demandes vous arrivent en dehors des heures d'ouverture, à votre avis ? Et qu'est-ce qui se passe pour ces gens-là aujourd'hui ? »",
    maquette:   "Montrez le module de réservation en action. Faites-lui imaginer les créneaux qui se remplissent seuls, même la nuit.",
    perte:      "Les clients qui cherchent un créneau le soir prennent le premier qui répond — souvent un concurrent qui a la réservation en ligne.",
    closing:    "On intègre la prise de RDV 24/7 — vous ne perdez plus une demande parce que vous étiez fermé.",
  },
  weak_google_presence: {
    decouverte: "« Vous savez combien d'avis Google vous avez aujourd'hui ? Et vos concurrents directs sur [ville] ? »",
    maquette:   "Montrez la fiche optimisée + la stratégie d'avis. Ancrez sur le classement local sur « [secteur] [ville] ».",
    perte:      "Sur une recherche « [secteur] [ville] », c'est le mieux noté qui rafle les appels. Aujourd'hui, ce n'est pas vous.",
    closing:    "On travaille votre visibilité locale — des résultats mesurables en 60 jours.",
  },
  no_pricing: {
    decouverte: "« Vous recevez beaucoup de demandes de devis qui ne donnent rien ? Les gens vous demandent souvent les prix avant tout ? »",
    maquette:   "Montrez une page claire qui pose un cadre tarifaire et filtre les demandes en amont.",
    perte:      "Un visiteur qui ne trouve aucune idée de prix part chez celui qui les affiche. Vous perdez des prospects qualifiés sans le voir.",
    closing:    "On structure ça pour attirer les bonnes demandes et écarter le reste.",
  },
  mobile_broken: {
    decouverte: "« Vous avez déjà ouvert votre site sur votre téléphone ? Vos clients vous cherchent plutôt sur ordi ou sur mobile, à votre avis ? »",
    maquette:   "Montrez la version mobile propre, côte à côte avec l'actuelle. Le téléphone en main, c'est imparable.",
    perte:      "70 % des recherches locales se font sur mobile. Un site cassé sur mobile, c'est 7 visiteurs sur 10 qui repartent — et Google qui vous déclasse.",
    closing:    "On rend le site impeccable sur mobile, là où sont réellement vos clients.",
  },
} as const;

export type SecteurKey = keyof typeof SECTEURS;
export type PainKey = keyof typeof PAIN_CONTENT;
export type PainSlot = keyof (typeof PAIN_CONTENT)[PainKey];

export const SECTEUR_LABELS: Record<SecteurKey, string> = {
  garage: "Garage / Auto",
  btp: "BTP / Artisan",
  sante: "Santé",
  commerce: "Commerce",
  coiffure: "Coiffure / Beauté",
  liberal: "Profession libérale",
  resto: "Restauration",
  autre: "Autre",
};

export const PAIN_LABELS: Record<PainKey, string> = {
  no_website: "Pas de site web",
  outdated_site: "Site daté / obsolète",
  no_online_booking: "Pas de réservation en ligne",
  weak_google_presence: "Présence Google faible",
  no_pricing: "Pas de tarifs affichés",
  mobile_broken: "Site cassé sur mobile",
};

// ============================================================
// Structure des 7 phases (squelette constant)
// ============================================================
export type TrameBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "pain"; slot: PainSlot; intro?: string }
  | { kind: "callout"; tone?: "info" | "warn"; text: string }
  | { kind: "logObjection" };

export interface TramePhase {
  id: number;
  title: string;
  timing?: string;
  blocks: TrameBlock[];
}

export const TRAME_PHASES: TramePhase[] = [
  {
    id: 0,
    title: "Avant le RDV",
    timing: "Prépa",
    blocks: [
      {
        kind: "list",
        title: "Checklist prépa",
        items: [
          "Maquette testée sur desktop ET mobile (chargement, liens, formulaire).",
          "Fiche relue : secteur, pain principal, historique des échanges.",
          "1 chiffre concret prêt (avis Google, concurrents, recherches/mois…).",
          "Fourchette de prix en tête (ancrage haut → cible).",
          "Logistique : lien visio / partage d'écran testé, au calme.",
        ],
      },
    ],
  },
  {
    id: 1,
    title: "Ouverture & cadrage",
    timing: "2-3 min",
    blocks: [
      {
        kind: "text",
        text: "« Merci d'avoir pris le temps. Pour qu'on soit efficaces : on prend 2-3 minutes pour que je comprenne bien {lieu}, ensuite je vous montre ce que j'ai préparé, et on regarde ensemble si ça a du sens pour vous. Ça vous convient ? »",
      },
      {
        kind: "callout",
        tone: "info",
        text: "Obtenez un « oui » explicite sur le déroulé avant d'avancer — c'est le premier petit engagement.",
      },
    ],
  },
  {
    id: 2,
    title: "Découverte",
    timing: "8-10 min",
    blocks: [
      {
        kind: "list",
        title: "3 questions d'ouverture",
        items: [
          "« Parlez-moi de votre activité — depuis quand, ce qui marche le mieux aujourd'hui ? »",
          "« Comment vos clients vous trouvent actuellement ? »",
          "« Qu'est-ce qui vous a donné envie qu'on échange ? »",
        ],
      },
      {
        kind: "pain",
        slot: "decouverte",
        intro: "Question ciblée (selon le pain identifié) :",
      },
      {
        kind: "list",
        title: "Signaux à capter",
        items: [
          "Ses mots exacts (à réutiliser en phase maquette).",
          "Ce qui le frustre concrètement.",
          "Ce qu'il a déjà tenté.",
          "Qui décide (lui seul ? un associé ?).",
        ],
      },
      {
        kind: "text",
        text: "Transition : « Si je comprends bien, [reformulation de son besoin]. C'est exactement ce que j'avais anticipé — laissez-moi vous montrer. »",
      },
    ],
  },
  {
    id: 3,
    title: "Présentation maquette",
    timing: "8-10 min",
    blocks: [
      {
        kind: "text",
        text: "Ancrage sur ses mots : « Vous venez de me dire [ses mots]. Regardez ce que j'ai préparé pour {lieu}. »",
      },
      {
        kind: "pain",
        slot: "maquette",
        intro: "Angle de présentation (selon le pain) :",
      },
      {
        kind: "callout",
        tone: "info",
        text: "Montrez la version MOBILE — téléphone en main. C'est là que sont la majorité de ses clients.",
      },
      {
        kind: "text",
        text: "Transition : « Concrètement, voilà ce qu'on mettrait en place pour vous. »",
      },
    ],
  },
  {
    id: 4,
    title: "Validation besoin & cadre",
    timing: "5 min",
    blocks: [
      {
        kind: "list",
        title: "Cadrer les 4 points",
        items: [
          "Périmètre : ce qu'on fait / ce qu'on ne fait pas.",
          "Décideur : « il y a quelqu'un d'autre dans la décision ? »",
          "Budget : poser la fourchette, observer la réaction.",
          "Délai : « pour quand, idéalement ? »",
        ],
      },
      {
        kind: "callout",
        tone: "info",
        text: "Sur toute objection → arbre CRAC : Creuser, Reformuler, Argumenter, Conclure. Puis loggez-la.",
      },
      { kind: "logObjection" },
    ],
  },
  {
    id: 5,
    title: "Closing & signature",
    timing: "5-7 min",
    blocks: [
      {
        kind: "pain",
        slot: "perte",
        intro: "1. Rappel de la perte actuelle :",
      },
      {
        kind: "text",
        text: "2. Annoncez le prix — clairement, posément, sans vous justifier.",
      },
      {
        kind: "callout",
        tone: "warn",
        text: "3. SILENCE. Ne comblez pas le silence après le prix. Le premier qui parle… écoute.",
      },
      {
        kind: "text",
        text: "4. Question ouverte : « Comment vous le sentez ? » / « Qu'est-ce qui vous retient ? »",
      },
      {
        kind: "pain",
        slot: "closing",
        intro: "5. Verrouillage + accroche finale :",
      },
      { kind: "logObjection" },
    ],
  },
  {
    id: 6,
    title: "Après le RDV",
    timing: "Suivi",
    blocks: [
      {
        kind: "list",
        title: "À faire dans les 2 h",
        items: [
          "Recap écrit envoyé (< 2 h).",
          "Objection rencontrée loggée dans le Tracker.",
          "Relance datée posée si pas signé.",
        ],
      },
      { kind: "logObjection" },
    ],
  },
];

// ============================================================
// Normalisation best-effort depuis raw_payload (toujours éditable)
// ============================================================

function lower(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null;
}

// Mots-clés → secteur, scannés dans l'ordre (le plus spécifique d'abord).
const SECTEUR_KEYWORDS: [SecteurKey, string[]][] = [
  ["resto", ["restaurant", "restauration", "pizzeria", "traiteur", "brasserie", "bar ", "food", "établissement", "etablissement", "snack", "kebab"]],
  ["garage", ["garage", "carrosserie", "automobile", "auto", "mécanique", "mecanique", "pneu"]],
  ["coiffure", ["coiffure", "coiffeur", "barbier", "esthétique", "esthetique", "esthéticienne", "estheticienne", "beauté", "beaute", "spa", "bien-être", "bien etre", "ongle", "institut"]],
  ["sante", ["kiné", "kine", "dentiste", "médecin", "medecin", "ostéo", "osteo", "infirmier", "podologue", "santé", "sante", "médical", "medical", "pharmacie"]],
  ["btp", ["maçon", "macon", "maconnerie", "maçonnerie", "peintre", "peinture", "électric", "electric", "plombier", "plomberie", "menuisier", "menuiserie", "carreleur", "couvreur", "paysagiste", "artisan", "chauffage", "climatisation", "btp", "bâtiment", "batiment", "rénovation", "renovation", "serrurier"]],
  ["commerce", ["caviste", "épicerie", "epicerie", "fleuriste", "chocolat", "primeur", "boulangerie", "pâtisserie", "patisserie", "fromagerie", "boutique", "commerce", "magasin"]],
  ["liberal", ["avocat", "notaire", "comptable", "consultant", "architecte", "libéral", "liberal", "profession", "cabinet conseil", "courtier"]],
];

/** Mappe un secteur texte-libre (raw_payload.sector/secteur) vers une clé. */
export function normalizeSector(raw: unknown): SecteurKey {
  const s = lower(raw);
  if (!s) return "autre";
  if (s in SECTEURS) return s as SecteurKey;
  for (const [key, words] of SECTEUR_KEYWORDS) {
    if (words.some((w) => s.includes(w))) return key;
  }
  return "autre";
}

// Variantes de pain → clé canonique.
const PAIN_KEYWORDS: [PainKey, string[]][] = [
  ["no_online_booking", ["booking", "réservation", "reservation", "prise de rdv", "prise de rendez", "planity", "rdv en ligne", "commande en ligne"]],
  ["outdated_site", ["old_site", "outdated", "daté", "date", "vieux site", "obsolète", "obsolete", "ancien site", "site vétuste", "vetuste"]],
  ["mobile_broken", ["mobile", "responsive", "smartphone", "téléphone", "telephone"]],
  ["no_pricing", ["prix", "tarif", "pricing", "devis", "no_pricing"]],
  ["weak_google_presence", ["avis", "google", "présence", "presence", "weak_google", "réputation", "reputation", "fiche google", "gmb"]],
  ["no_website", ["no_website", "no_own_website", "pas de site", "pas de vrai site", "aucun site", "sans site", "facebook_only", "page facebook", "facebook uniquement", "site_blocked", "no site"]],
];

function isCanonicalPain(s: string): PainKey | null {
  return (s in PAIN_CONTENT ? (s as PainKey) : null);
}

/** Déduit le pain principal (clé PAIN_CONTENT) depuis raw_payload, ou null. */
export function normalizePain(
  rawPayload: Record<string, unknown> | null | undefined
): PainKey | null {
  if (!rawPayload) return null;

  const candidates = [
    lower(rawPayload.pain),
    lower(rawPayload.pain_principal),
    lower(rawPayload.pain_reason),
    lower(rawPayload.main_pain),
  ].filter((v): v is string => !!v);

  // 1) clé canonique directe
  for (const c of candidates) {
    const direct = isCanonicalPain(c);
    if (direct) return direct;
  }
  // 2) site_audit.has_website === false → pas de site
  const audit = rawPayload.site_audit;
  if (audit && typeof audit === "object" && (audit as { has_website?: unknown }).has_website === false) {
    return "no_website";
  }
  // 3) mapping par mots-clés (ignore les valeurs purement numériques type "0.90")
  for (const c of candidates) {
    if (/^[\d.,\s]+$/.test(c)) continue;
    for (const [key, words] of PAIN_KEYWORDS) {
      if (words.some((w) => c.includes(w))) return key;
    }
  }
  return null;
}

/**
 * Valeur de pré-remplissage pour le champ `pain_id` du logger d'objection.
 * Renvoie la clé canonique détectée, sinon null (champ laissé éditable).
 */
export function detectPainId(
  rawPayload: Record<string, unknown> | null | undefined
): string | null {
  return normalizePain(rawPayload);
}

/** Interpole {lieu}/{metier} dans un texte de phase. */
export function interpolateSecteur(text: string, secteur: SecteurKey): string {
  const { lieu, metier } = SECTEURS[secteur];
  return text.replace(/\{lieu\}/g, lieu).replace(/\{metier\}/g, metier);
}
