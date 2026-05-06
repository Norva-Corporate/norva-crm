---
name: prospection-email-discovery
description: Use this skill when you need to find a prospect's professional email address. Tries multiple sources in priority order (their site, Pages Jaunes, Facebook business page, Instagram bio, Pappers.fr) and stops at the first credible pro email. Best-effort and non-blocking — for French TPE/artisans, no public pro email is common and a phone number alone is sufficient. Never fabricate addresses.
---

# Skill — Recherche email professionnel

## Quand utiliser cette skill

Après le discovery Google Places, pour tenter d'enrichir le prospect
avec un email pro. **Best-effort, pas bloquant**.

Pour un artisan/TPE/coiffeur, l'email pro public est **souvent
inexistant**. C'est un cas normal : un téléphone valide suffit.

## Ordre de recherche (s'arrêter au premier email pro crédible)

### 1. Site web officiel (si présent)

- Fetch homepage du `websiteUri`
- Fetch `/contact` et `/mentions-legales` (obligatoires pour pro FR)
- Cherche dans le footer, les `<a href="mailto:">`, le texte légal

### 2. Pages Jaunes

URL : `https://www.pagesjaunes.fr/recherche/<ville>/<activité>`

Cherche le nom commercial dans les résultats. Si fiche détaillée
disponible, l'email apparaît parfois.

### 3. Facebook Business

Google search : `<nom entreprise> facebook` → fetch la première URL
`facebook.com/...` → cherche dans la section "À propos" / "About" /
"Informations".

### 4. Instagram

Google search : `<nom entreprise> instagram` → fetch
`instagram.com/<handle>` → bio + lien externe (souvent un Linktree
qui mène au site ou à un formulaire).

### 5. Pappers.fr

URL : `https://www.pappers.fr/recherche?q=<nom>`

Pour le SIREN/dirigeant principalement. L'email est rarement présent
mais ça arrive sur les fiches détaillées.

## Filtre obligatoire sur l'email trouvé

Email **rejeté** (= traité comme non-trouvé) si domaine appartient à :

    gmail.com, yahoo.com, yahoo.fr, hotmail.com, hotmail.fr,
    outlook.com, outlook.fr, icloud.com, free.fr, orange.fr,
    wanadoo.fr, laposte.net, sfr.fr, aol.com, live.com, live.fr,
    bbox.fr, neuf.fr

Dans ce cas :

- `email` reste `NULL` dans `lead_imports`
- Note dans `raw_payload.contact_email_personal: "<email perso>"`
- Mention dans `raw_payload.notes` (ex. "Pas d'adresse pro, gérant
  joignable sur gmail à valider à l'oral d'abord")

## Cas "rien trouvé"

Cas valide. Le prospect reste insérable s'il a au moins un téléphone.

- `email = NULL`
- `raw_payload.notes` mentionne "Pas d'email pro public — contact via
  téléphone."
- Le scoring Reach perd 0.3 mais reste >= 0.5 si le téléphone est
  trouvé.

## Règles strictes

- ❌ **JAMAIS inventer** un email basé sur "supposition"
  (ex. `prenom.nom@<domaine>` deviné).
- ❌ Si un email apparaît dans une URL/lien social mais c'est un email
  perso (gmail/etc.), ne le mets PAS en `email`.
- ✅ Mets en minuscules systématiquement.
- ✅ Si plusieurs emails pro trouvés (ex. `contact@` et
  `prenom@`), préfère celui qui correspond au dirigeant identifié.
