---
name: prospection-email-discovery
description: Use this skill to find a prospect's email address (pro OR personal) through deep multi-source search. Priority order is mentions-légales (mandatory by French LCEN law on commercial websites), LinkedIn (Sales Navigator + public profile scraping), full multi-page site crawl with sitemap discovery, Pages Jaunes, Pappers, social profiles, Google search for plain-text email mentions, and Hunter.io free tier as last resort. All email formats accepted (pro and personal — gmail, yahoo, outlook, etc.). Best-effort and non-blocking — never fabricates addresses.
---

# Skill — Recherche email professionnel (deep search)

## Quand utiliser

Après le discovery Google Places + l'enrichissement API gouv, pour
tenter de trouver un email pro. **Best-effort, pas bloquant**.

## Taux de hit attendu (cadrage)

| Cible | Hit rate email pro |
|-------|---------------------|
| Startups / SaaS / agences | 70-90% |
| PME industrielles établies | 50-70% |
| Commerces de centre-ville (resto, mode) | 30-50% |
| **Artisans / coiffeurs / TPE de quartier** | **20-40%** |
| Auto-entrepreneurs solos | 10-20% |

Si tu trouves moins, ce n'est PAS un bug — beaucoup de TPE n'ont
**aucun email pro public**, juste un gmail/yahoo (= NULL pour nous)
ou rien. Le téléphone seul reste un bon canal.

## Ordre de recherche (s'arrêter au premier email pro crédible)

### 1. PRIORITAIRE — `/mentions-legales` du site (loi française)

La loi LCEN art. 6-III oblige tout site commercial français à publier
dans ses mentions légales :

- Nom + prénom du responsable
- Adresse postale
- **Email de contact**
- **Téléphone**
- **SIRET / SIREN**
- Forme juridique, capital, n° TVA intra (pour sociétés)

→ Source la **plus fiable** pour email pro + dirigeant + SIRET.

**8 URLs à tenter** dans cet ordre sur le `websiteUri` :

1. `<site>/mentions-legales`
2. `<site>/mentions-legales/`
3. `<site>/mentions`
4. `<site>/legal`
5. `<site>/legals`
6. `<site>/cgv` (mentions parfois groupées avec CGV)
7. `<site>/conditions-generales`
8. La homepage : footer (lien `Mentions légales` souvent présent)

Cherche avec WebFetch et extrais avec regex :

- Email : `[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}` (case-insensitive)
- Téléphone : `^(\+33|0)[1-9](\s?\d{2}){4}$`
- SIRET : `\b\d{14}\b`
- Nom du gérant : juste après "représenté(e) par",
  "directeur de la publication :", "responsable :"

### 1bis. PRIORITAIRE (équivalent à l'étape 1) — LinkedIn

À tenter **en parallèle** des mentions légales, particulièrement pour
startups / PME / ETI où LinkedIn donne souvent plus que les mentions
légales (décisionnaire identifié, parfois email pro exposé).

**Sales Navigator (si dispo)** :

- Recherche par entreprise + filtres seniority (CEO, founder, head of,
  directeur, gérant)
- Récupérer prénom + nom + intitulé du poste
- L'export d'email Sales Nav (via add-on type Lusha/Apollo) est
  autorisé si vous avez un abonnement

**Profils publics (sans Sales Nav)** :

- Recherche Google : `site:linkedin.com/in "<entreprise>" <ville>`
- Recherche Google : `site:linkedin.com/company/<slug>`
- Scraping autorisé sur le HTML public des profils et pages entreprise
  (la page "À propos" expose souvent un email)

Ce que tu cherches :

- Email pro ou perso exposé dans la bio / contact info
- Prénom + nom + titre du dirigeant (alimente Reach + l'enrichissement
  gouv si match)
- URL LinkedIn elle-même (à stocker dans `raw_payload.linkedin`)

Note dans `raw_payload.sources` : `"linkedin"` quand utilisé.

### 2. Sitemap.xml + crawl multi-pages

Fetch `<site>/sitemap.xml` ou `<site>/robots.txt`. Extrais TOUTES les
URLs internes. Pour celles qui matchent ces patterns, fetch et cherche
des emails :

- `/contact`, `/contactez-nous`, `/nous-contacter`
- `/a-propos`, `/about`, `/qui-sommes-nous`
- `/equipe`, `/notre-equipe`, `/team`
- `/tarifs`, `/prestations`, `/services`
- `/devis`, `/demande-devis`
- `/cgv`, `/conditions-generales-de-vente`
- `/footer` (parfois page dédiée)

Si pas de sitemap, fetch au moins `<site>/contact` et la homepage et
parse les liens internes pour identifier ces pages.

### 3. Recherche Google ciblée — emails en plain text

Pour les sites qui ont un email mais pas dans /mentions-legales :

Google search via WebFetch :

    https://www.google.com/search?q=%22@<domain>%22+site%3A<domain>

Exemple pour `acme.fr` :

    https://www.google.com/search?q=%22@acme.fr%22+site%3Aacme.fr

Cherche les snippets contenant un email. Les pages PDF ou les pages
profondes du site révèlent souvent un email pro.

Variation utile : `<nom entreprise> <ville> contact email`.

### 4. Pages Jaunes — fiche complète

`https://www.pagesjaunes.fr/recherche/<ville>/<activité>`

Cherche le nom commercial. Sur la fiche détaillée, l'email pro
apparaît si le pro a payé pour la visibilité (~30% des cas pour les
artisans bien implantés).

### 5. Société.com et Pappers (publique)

- `https://www.societe.com/cgi-bin/search?champs=<nom>`
- `https://www.pappers.fr/recherche?q=<nom entreprise>`

Email rarement présent mais arrive sur les fiches détaillées de
sociétés établies.

### 6. Réseaux sociaux

#### Facebook Business

Google : `<nom entreprise> <ville> facebook` → fetch URL
`facebook.com/...` → section "À propos" / "About" / "Informations" →
champ "Email".

#### Instagram

Google : `<nom entreprise> instagram` → fetch
`instagram.com/<handle>` → bio + lien externe (Linktree, Beacons).

#### LinkedIn

Pour les startups/PME tech : la page entreprise LinkedIn affiche
parfois un email pro dans "À propos".

### 7. (Optionnel) Hunter.io free tier — 25 recherches/mois

Si toujours rien et que tu as un domaine pro :

    GET https://api.hunter.io/v2/domain-search?domain=<domain>&api_key=<key>

Retourne les emails connus liés à ce domaine. Hunter scrape massivement
le web public, donc trouve souvent ce que toi tu loupes.

⚠️ Skip si pas de `HUNTER_API_KEY` dans l'environnement. Économise le
quota : ne pas appeler si le domaine est gratuit (gmail/yahoo) ou
si tu as déjà trouvé un email via une autre source.

### 8. Pattern guessing — DERNIER RECOURS, suggestion seulement

Si tu as :
- Le **domaine pro** confirmé (ex `salonacme.fr`)
- Le **prénom et nom du dirigeant** (ex `Marie Dupont`)

Mais aucun email trouvé après les étapes 1-7 → tu peux **suggérer**
des patterns probables dans `raw_payload.notes` (sans les insérer
en `email`) :

> "Aucun email pro trouvé. Patterns probables à tester manuellement :
> contact@salonacme.fr, marie@salonacme.fr, marie.dupont@salonacme.fr.
> À valider avant cold mail."

❌ **Ne jamais insérer un email deviné dans le champ `email`** — risque
de bouncing et de blacklist domaine. Toujours garder NULL.

## Tous formats d'emails acceptés

**Tous les emails sont acceptés en `email`**, qu'ils soient pro ou
persos (gmail, yahoo, outlook, free.fr, orange.fr, icloud, proton,
etc.). On ne filtre plus.

**Préférence (si plusieurs trouvés)** :

1. Email pro exact du dirigeant (`prenom.nom@<domaine_entreprise>`)
2. Email pro générique (`contact@`, `info@`, `direction@`)
3. Email perso du dirigeant (gmail, yahoo, etc.)
4. Email perso générique trouvé dans une fiche commerciale

**Tagger systématiquement** dans `raw_payload` :

    "email_type": "pro" | "personal"

Règle de classification :

- `pro` si le domaine de l'email matche le `company_domain`
- `personal` si domaine grand public (gmail.com, yahoo.com,
  hotmail.com, outlook.com, icloud.com, free.fr, orange.fr,
  wanadoo.fr, laposte.net, sfr.fr, aol.com, live.com, live.fr,
  bbox.fr, neuf.fr, gmx.fr, gmx.com, protonmail.com, proton.me,
  me.com, mac.com)
- `pro` par défaut sinon

Si email perso, ajouter dans `raw_payload.notes` :
"Email perso (`<provider>`) — à valider à l'oral avant cold mail."

## Cas "rien trouvé"

Cas valide. Le prospect reste insérable s'il a au moins un téléphone.

- `email = NULL`
- `raw_payload.notes` : "Pas d'email pro public — contact via téléphone."
- `raw_payload.email_search` : indique les sources tentées (ex
  `["mentions-legales", "sitemap", "google", "pages-jaunes"]`) pour
  qu'on sache que la recherche a été exhaustive

## Stockage final dans `raw_payload`

Pour traçabilité :

    "email_search": {
      "tried": ["mentions-legales", "sitemap", "google", "pages-jaunes", "facebook"],
      "found_pro": true|false,
      "found_personal": true|false,
      "patterns_suggested": ["contact@acme.fr", "marie@acme.fr"]
    }

## Règles strictes

- ❌ JAMAIS inventer un email basé sur supposition + insérer dans
  `email`. Les patterns vont dans `notes` uniquement.
- ✅ Tous formats d'email acceptés en `email` (pro ou perso).
  Toujours tagger `raw_payload.email_type` (`"pro"` ou `"personal"`).
- ✅ Toujours minuscules.
- ✅ Si plusieurs emails trouvés, préférer dans l'ordre : email pro
  du dirigeant > email pro générique (`contact@`, `info@`,
  `direction@`) > email perso du dirigeant > email perso générique.
- ✅ Si tu trouves un SIRET dans /mentions-legales, ajoute-le aussi
  dans `raw_payload.siret` (peut servir si l'API gouv n'a pas matché).
- ✅ Si tu trouves un profil LinkedIn, stocke l'URL dans
  `raw_payload.linkedin`.
