---
name: prospection-email-discovery
description: Find a prospect's email (pro or personal) via multi-source search. Priority : mentions-légales (LCEN obligatory in FR), LinkedIn, sitemap + page crawl, Pages Jaunes, Pappers, social profiles, Google search, Hunter.io free as last resort. All formats accepted, tag email_type pro/personal. Best-effort, non-blocking.
---

# Skill — Recherche email (deep search)

## Quand utiliser

Après le discovery Google Places + enrichissement gouv. **Best-effort,
pas bloquant** — un prospect avec tel seul reste insérable.

## Ordre de recherche (stop au 1er email crédible)

### 1. `/mentions-legales` (PRIORITAIRE — loi LCEN art. 6-III)

Tester 8 URLs dans cet ordre :
`/mentions-legales`, `/mentions-legales/`, `/mentions`, `/legal`,
`/legals`, `/cgv`, `/conditions-generales`, footer homepage.

Extraire via regex :
- Email : `[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}`
- Tél : `^(\+33|0)[1-9](\s?\d{2}){4}$`
- SIRET : `\b\d{14}\b`
- Dirigeant : après "représenté(e) par", "directeur de la publication :"

### 2. LinkedIn (parallèle à mentions-legales)

Google search : `site:linkedin.com/in "<entreprise>" <ville>`.
Récupère email, prénom/nom, URL profil. Stocker URL dans
`raw_payload.linkedin`.

### 3. Sitemap + crawl

Fetch `/sitemap.xml`. Pour URLs matchant : `/contact`, `/a-propos`,
`/equipe`, `/tarifs`, `/devis`, `/cgv` → extraire emails.

### 4. Google search ciblé

WebFetch `https://www.google.com/search?q=%22@<domain>%22+site%3A<domain>`.
Cherche emails dans snippets.

### 5. Pages Jaunes / Société.com / Pappers public

`https://www.pagesjaunes.fr/recherche/<ville>/<activité>`.
Email parfois sur fiche détaillée.

### 6. Réseaux sociaux (Facebook About, Instagram bio)

Cherche email dans "À propos" / bio.

### 7. Hunter.io free (25/mois, optionnel)

Si `HUNTER_API_KEY` et domaine pro non-webmail :
`GET https://api.hunter.io/v2/domain-search?domain=<domain>&api_key=<key>`

### 8. Pattern guessing — JAMAIS dans `email`

Si dirigeant + domaine connus mais aucun email trouvé : suggérer dans
`raw_payload.notes` (ex `marie@acme.fr`, `contact@acme.fr`) — mais
**NULL dans la colonne `email`**.

## Classification pro vs personal

Domaines `personal` (à tagger) : gmail, yahoo, hotmail, outlook,
icloud, free.fr, orange.fr, wanadoo.fr, laposte.net, sfr.fr, aol.com,
live.com, live.fr, bbox.fr, neuf.fr, gmx.fr, gmx.com, protonmail.com,
proton.me, me.com, mac.com.

Sinon `pro` (domaine matche `company_domain`).

Préférence si plusieurs : pro dirigeant > pro générique (contact@, info@) > perso dirigeant > perso générique.

## Output `raw_payload`

```json
{
  "email_type": "pro" | "personal",
  "email_search": {
    "tried": ["mentions-legales", "sitemap", "google", "pages-jaunes"],
    "found_pro": true,
    "patterns_suggested": ["contact@acme.fr"]
  }
}
```

## Cas "rien trouvé"

`email = NULL`. Lead reste insérable s'il a un téléphone.

## Règles strictes

- ❌ JAMAIS insérer un email deviné dans la colonne `email`
  (= bounce + blacklist domaine)
- ✅ Tous formats acceptés (pro ou perso), tagger `email_type`
- ✅ Toujours minuscules
