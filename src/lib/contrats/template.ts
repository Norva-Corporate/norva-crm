// Source de vérité du contenu juridique du contrat de prestation Norva.
// Modifier ici pour faire évoluer les clauses : le PDF se régénère à
// chaque génération depuis ce template.

export interface ContratOptions {
  site: boolean;
  maintenance: boolean;
  seo_ads: boolean;
  social: boolean;
}

export interface ContratClientSnapshot {
  raison_sociale: string;
  siret: string;
  email: string;
  phone?: string | null;
  representant?: string | null;
  adresse?: string | null;
}

export const OPTION_LABELS: Record<keyof ContratOptions, string> = {
  site: "Création d'un site internet sur mesure",
  maintenance: "Maintenance technique, éditoriale et hébergement",
  seo_ads: "Référencement naturel (SEO) et campagnes publicitaires (Ads)",
  social: "Gestion des réseaux sociaux et production de contenus",
};

export const OPTION_DESCRIPTIONS: Record<keyof ContratOptions, string> = {
  site:
    "Conception graphique, développement front-end et back-end, intégration des contenus, recettage, mise en ligne sur l'hébergement du Prestataire ou du Client, et transfert de propriété à la livraison.",
  maintenance:
    "Mises à jour techniques, sauvegardes, supervision de disponibilité, corrections d'anomalies, hébergement et accompagnement éditorial mensuel.",
  seo_ads:
    "Audit, optimisation on-page et off-page, gestion de campagnes Google Ads / Meta Ads, suivi des conversions et reporting mensuel.",
  social:
    "Planification éditoriale, création visuelle, rédaction des posts, modération de premier niveau et reporting mensuel.",
};

export interface ContratSection {
  num: string;
  title: string;
  bodyHtml: string;
}

export function buildSections(input: {
  client: ContratClientSnapshot;
  options: ContratOptions;
  montant_total: number;
  acompte: number;
  solde: number;
}): ContratSection[] {
  const { client, options, montant_total, acompte, solde } = input;

  const activeOptions = (
    Object.entries(options) as [keyof ContratOptions, boolean][]
  ).filter(([, active]) => active);

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(n);

  return [
    {
      num: "01",
      title: "Préambule",
      bodyHtml: `
        <p>Le présent contrat est conclu entre :</p>
        <p class="party">
          <strong>Norva Corporate</strong>, ci-après désigné « le Prestataire ».
        </p>
        <p class="party">
          <strong>${escapeHtml(client.raison_sociale)}</strong>, SIRET
          ${escapeHtml(client.siret)}${
            client.adresse ? `, ${escapeHtml(client.adresse)}` : ""
          }, représenté${
            client.representant
              ? ` par ${escapeHtml(client.representant)}`
              : ""
          }, ci-après désigné « le Client ».
        </p>
      `,
    },
    {
      num: "02",
      title: "Objet du contrat",
      bodyHtml: `
        <p>
          Le présent contrat a pour objet de définir les conditions dans
          lesquelles le Prestataire fournit au Client les services décrits
          à l'article 3, à titre onéreux, dans le respect des engagements
          réciproques décrits ci-après.
        </p>
      `,
    },
    {
      num: "03",
      title: "Périmètre de la prestation",
      bodyHtml: activeOptions.length
        ? `
          <p>Le périmètre retenu par le Client comprend les services suivants :</p>
          <ul class="scope">
            ${activeOptions
              .map(
                ([key]) => `
                <li>
                  <span class="scope-title">${escapeHtml(
                    OPTION_LABELS[key]
                  )}</span>
                  <span class="scope-desc">${escapeHtml(
                    OPTION_DESCRIPTIONS[key]
                  )}</span>
                </li>
              `
              )
              .join("")}
          </ul>
        `
        : `<p class="muted-italic">Aucune option n'a été sélectionnée.</p>`,
    },
    {
      num: "04",
      title: "Durée",
      bodyHtml: `
        <p>
          Le contrat prend effet à compter de sa signature par les deux
          parties. Les prestations ponctuelles (création de site,
          campagnes) sont réalisées jusqu'à livraison ; les prestations
          récurrentes (maintenance, SEO/Ads, social) sont engagées pour
          une durée minimale de douze (12) mois, reconductible tacitement
          par périodes de douze (12) mois, sauf dénonciation par l'une
          des parties par lettre recommandée avec accusé de réception,
          au moins soixante (60) jours avant l'échéance.
        </p>
      `,
    },
    {
      num: "05",
      title: "Conditions financières",
      bodyHtml: `
        <p>
          Le montant total des prestations, hors taxes, s'élève à
          <strong>${fmt(montant_total)}</strong>.
        </p>
        <table class="fin-tbl">
          <tbody>
            <tr>
              <th>Acompte à la signature (30 %)</th>
              <td>${fmt(acompte)}</td>
            </tr>
            <tr>
              <th>Solde à la livraison (70 %)</th>
              <td>${fmt(solde)}</td>
            </tr>
          </tbody>
        </table>
        <p class="fin-note">
          Les sommes sont exigibles à réception de facture. Tout retard de
          paiement entraîne, de plein droit et sans mise en demeure
          préalable, l'application d'intérêts de retard au taux de
          référence de la BCE majoré de dix (10) points, ainsi qu'une
          indemnité forfaitaire pour frais de recouvrement de 40 €
          (article L441-10 du Code de commerce).
        </p>
      `,
    },
    {
      num: "06",
      title: "Livrables et obligations des parties",
      bodyHtml: `
        <p>
          Le Prestataire s'engage à exécuter les prestations dans les
          règles de l'art et en mettant en œuvre les moyens raisonnables
          adaptés à la nature des services rendus (obligation de moyens).
        </p>
        <p>
          Le Client s'engage à fournir, dans des délais raisonnables,
          l'ensemble des éléments nécessaires à la bonne exécution du
          contrat (accès, contenus, validations, retours qualifiés). Tout
          retard du Client suspend les délais du Prestataire à due
          concurrence.
        </p>
      `,
    },
    {
      num: "07",
      title: "Propriété intellectuelle",
      bodyHtml: `
        <p>
          Les livrables réalisés spécifiquement pour le Client sont cédés
          à ce dernier dès paiement intégral des sommes dues. Les
          composants génériques (frameworks, bibliothèques, outils de
          gestion) restent la propriété de leurs auteurs respectifs et du
          Prestataire et sont concédés au Client selon les licences en
          vigueur.
        </p>
      `,
    },
    {
      num: "08",
      title: "Confidentialité",
      bodyHtml: `
        <p>
          Chacune des parties s'engage à préserver la confidentialité des
          informations qui lui sont communiquées par l'autre partie au
          titre du présent contrat, pendant toute sa durée et pour une
          période de trois (3) ans à compter de sa cessation.
        </p>
      `,
    },
    {
      num: "09",
      title: "Données personnelles (RGPD)",
      bodyHtml: `
        <p>
          Le Prestataire agit en qualité de sous-traitant au sens de
          l'article 28 du RGPD pour les traitements effectués pour le
          compte du Client. Il met en œuvre les mesures techniques et
          organisationnelles appropriées pour garantir un niveau de
          sécurité adapté au risque, et n'effectue de transfert hors UE
          que sous garanties appropriées.
        </p>
      `,
    },
    {
      num: "10",
      title: "Résiliation",
      bodyHtml: `
        <p>
          En cas de manquement grave de l'une des parties à ses
          obligations, l'autre partie peut résilier le contrat de plein
          droit, trente (30) jours après l'envoi d'une mise en demeure
          restée sans effet, sans préjudice de tous dommages et intérêts.
        </p>
      `,
    },
    {
      num: "11",
      title: "Droit applicable et juridiction compétente",
      bodyHtml: `
        <p>
          Le présent contrat est régi par le droit français. À défaut
          d'accord amiable, tout litige relatif à sa formation, son
          exécution ou son interprétation relève de la compétence
          exclusive des tribunaux du ressort du siège du Prestataire.
        </p>
      `,
    },
  ];
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
