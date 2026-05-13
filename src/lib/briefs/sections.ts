/**
 * Définition des 10 sections du brief client.
 *
 * Schéma synchronisé avec la maquette `DA/norva-brief-client.html`
 * et le formulaire vitrine `Site_vitrine/app/brief/_components/BriefForm.tsx`.
 *
 * Utilisée par :
 *   - La page détail brief (rendu groupé par section)
 *   - La génération PDF (template HTML serveur)
 *   - L'email de notification Resend (aperçu par section)
 */

export interface BriefSection {
  id: string;
  /** Numéro + nom affiché dans le rendu (PDF + UI) */
  label: string;
  /** Préfixe des clés de `reponses` qui appartiennent à cette section */
  prefix: string;
  /** Labels lisibles par clé (sinon humanize automatique) */
  fields?: Record<string, string>;
}

export const BRIEF_SECTIONS: readonly BriefSection[] = [
  {
    id: "entreprise",
    label: "01. Entreprise & Positionnement",
    prefix: "entreprise_",
    fields: {
      entreprise_nom: "Nom de l'entreprise",
      entreprise_secteur: "Secteur d'activité",
      entreprise_annee_creation: "Année de création",
      entreprise_effectif: "Effectif approximatif",
      entreprise_activite_description: "Description de l'activité",
      entreprise_positionnement: "Positionnement & différenciation",
      entreprise_ton: "Ton & personnalité",
      entreprise_ton_precision: "Précisions sur le ton",
    },
  },
  {
    id: "objectifs",
    label: "02. Objectifs Business du Site",
    prefix: "objectifs_",
    fields: {
      objectifs_principal: "Objectif principal",
      objectifs_secondaires: "Objectifs secondaires",
      objectifs_situation_actuelle: "Situation actuelle",
    },
  },
  {
    id: "cibles",
    label: "03. Cibles & Audiences",
    prefix: "cibles_",
    fields: {
      cibles_principale: "Cible principale",
      cibles_secondaires: "Cibles secondaires",
      cibles_zone_geo: "Zone géographique",
    },
  },
  {
    id: "concurrents",
    label: "04. Concurrents & Inspirations",
    prefix: "concurrents_",
    fields: {
      concurrents_inspirations: "Sites que vous aimez",
      concurrents_a_eviter: "Sites que vous n'aimez pas",
      concurrents_directs: "Concurrents directs",
    },
  },
  {
    id: "contenu",
    label: "05. Contenu Existant & à Produire",
    prefix: "contenu_",
    fields: {
      contenu_textes: "Textes rédactionnels",
      contenu_visuels: "Visuels & médias",
      contenu_charte: "Charte graphique",
      contenu_precisions: "Précisions sur les contenus",
    },
  },
  {
    id: "fonctionnel",
    label: "06. Périmètre Fonctionnel",
    prefix: "fonctionnel_",
    fields: {
      fonctionnel_pages: "Pages souhaitées",
      fonctionnel_features: "Fonctionnalités requises",
      fonctionnel_features_autres: "Fonctionnalités spécifiques",
      fonctionnel_outils: "Outils à intégrer",
    },
  },
  {
    id: "technique",
    label: "07. Contraintes Techniques",
    prefix: "technique_",
    fields: {
      technique_cms: "CMS / technologie",
      technique_hebergement: "Hébergement existant",
      technique_domaine: "Nom de domaine",
      technique_contraintes: "Contraintes spécifiques",
      technique_autonomie: "Autonomie d'édition",
    },
  },
  {
    id: "budget",
    label: "08. Budget & Timing",
    prefix: "budget_",
    fields: {
      budget_enveloppe: "Enveloppe budgétaire",
      budget_date_mise_en_ligne: "Date de mise en ligne",
      budget_date_butoir: "Date butoir absolue",
      budget_contexte: "Contexte timing",
    },
  },
  {
    id: "process",
    label: "09. Process de Validation & Interlocuteurs",
    prefix: "process_",
    fields: {
      process_interlocuteurs: "Interlocuteurs projet",
      process_rounds: "Rounds de corrections",
      process_disponibilites: "Disponibilité pour les échanges",
    },
  },
  {
    id: "succes",
    label: "10. Indicateurs de Succès Post-Lancement",
    prefix: "succes_",
    fields: {
      succes_kpis: "KPI prioritaires à 3 mois",
      succes_outils: "Outils de mesure",
      succes_complement: "Informations complémentaires",
    },
  },
];

/**
 * Mapping option key → label affichable, par champ.
 * Le formulaire vitrine sérialise les choix sous forme de clés stables
 * (`leads`, `wordpress`, etc.) — ce mapping les rend lisibles côté CRM
 * sans dépendre du label exact stocké côté front.
 */
export const OPTION_LABELS: Record<string, Record<string, string>> = {
  entreprise_ton: {
    serieux_expert: "Sérieux & expert",
    dynamique_moderne: "Dynamique & moderne",
    accessible_humain: "Accessible & humain",
    premium_exclusif: "Premium & exclusif",
    innovant_tech: "Innovant & tech",
    local_proximite: "Local & de proximité",
    rassurant_institutionnel: "Rassurant & institutionnel",
    autre: "Autre",
  },
  objectifs_principal: {
    leads: "Génération de leads / prise de contact",
    ecommerce: "Vente en ligne (e-commerce)",
    notoriete: "Notoriété & image de marque",
    recrutement: "Recrutement",
    autre: "Autre",
  },
  cibles_zone_geo: {
    locale: "Locale (ville / département)",
    regionale: "Régionale",
    nationale: "Nationale (France)",
    europe: "Europe",
    international: "International",
    multilingue: "Multilingue requis",
  },
  contenu_textes: {
    tous_prets: "Tous les textes sont prêts",
    partiel: "Partiellement prêts",
    a_produire: "Rien de prêt — rédaction à prévoir",
  },
  contenu_visuels: {
    photos_dispo: "Photos professionnelles disponibles",
    photos_shooting: "Photos à commander (shooting)",
    illustrations: "Illustrations / icônes fournies",
    videos: "Vidéo(s) disponible(s)",
    banque_images: "Banque d'images à acheter",
    aucun: "Aucun visuel disponible",
  },
  contenu_charte: {
    complete: "Charte complète disponible",
    logo_seul: "Logo uniquement",
    a_creer: "Identité complète à créer",
  },
  fonctionnel_features: {
    formulaire_contact: "Formulaire de contact",
    prise_rdv: "Prise de rendez-vous en ligne",
    blog: "Blog / actualités",
    ecommerce: "E-commerce / boutique",
    espace_client: "Espace client / connexion",
    multilingue: "Multilingue",
    chat: "Chat / widget support",
    carte: "Carte interactive",
    newsletter: "Newsletter / emailing",
    configurateur: "Configurateur / simulateur",
    galerie: "Galerie / portfolio filtrable",
    telechargement: "Téléchargement de documents",
  },
  technique_cms: {
    norva_recommande: "Pas de préférence — norva. recommande",
    wordpress: "WordPress",
    webflow: "Webflow",
    shopify: "Shopify (e-commerce)",
    sur_mesure: "Développement sur-mesure",
    autre: "Autre",
  },
  technique_autonomie: {
    oui: "Oui — interface simple, sans compétences techniques",
    partiel: "Partiellement — quelques pages modifiables seulement",
    non: "Non — maintenance déléguée à norva.",
  },
  budget_enveloppe: {
    starter: "Starter (— 3 000 €)",
    standard: "Standard (3 000 – 8 000 €)",
    pro: "Pro (8 000 – 20 000 €)",
    sur_mesure: "Sur-mesure (20 000 €+)",
  },
  process_rounds: {
    "1_round": "1 round par livrable",
    "2_rounds": "2 rounds (standard)",
    non_defini: "Non défini — à préciser dans le contrat",
  },
  succes_outils: {
    ga4: "Google Analytics 4",
    search_console: "Google Search Console",
    tableau_sur_mesure: "Tableau de bord sur-mesure",
    hotjar: "Hotjar / enregistrements",
    reporting_norva: "Reporting mensuel norva.",
    existant: "Outil existant à connecter",
  },
};

/** Libellés des clés du kpi-grid (objet, pas array). */
export const KPI_LABELS: Record<string, string> = {
  leads_mois: "Leads / mois",
  trafic_organique: "Trafic organique",
  conversion: "Taux de conversion",
  chiffre_affaires: "Chiffre d'affaires",
  autre: "Autre indicateur",
  delai_reference: "Délai de référence",
};

/**
 * Convertit une option-key en label lisible.
 * Fallback: humanize de la clé si non trouvée dans la map.
 */
export function labelForOption(fieldName: string, key: string): string {
  return (
    OPTION_LABELS[fieldName]?.[key] ??
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export interface GroupedField {
  key: string;
  label: string;
  value: unknown;
}

export interface GroupedSection {
  section: BriefSection;
  fields: GroupedField[];
}

export interface BriefGroupResult {
  sections: GroupedSection[];
  /** Champs qui ne matchent aucun préfixe de section connue */
  orphans: GroupedField[];
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function groupReponsesBySections(
  reponses: Record<string, unknown>
): BriefGroupResult {
  const entries = Object.entries(reponses ?? {});
  const sections: GroupedSection[] = BRIEF_SECTIONS.map((s) => ({
    section: s,
    fields: [],
  }));
  const orphans: GroupedField[] = [];

  for (const [key, value] of entries) {
    const idx = BRIEF_SECTIONS.findIndex((s) => key.startsWith(s.prefix));
    const field: GroupedField = {
      key,
      label: BRIEF_SECTIONS[idx]?.fields?.[key] ?? humanizeKey(key),
      value,
    };
    if (idx === -1) orphans.push(field);
    else sections[idx].fields.push(field);
  }

  return {
    sections: sections.filter((s) => s.fields.length > 0),
    orphans,
  };
}
