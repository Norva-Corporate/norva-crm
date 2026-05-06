---
name: prospection-email-discovery
description: Use this skill to find a prospect's professional email address through deep search across multiple French and international sources. Priority order is mentions-légales (French law mandates email/SIRET/dirigeant on commercial websites), site contact pages, Pages Jaunes, social profiles (Facebook About, Instagram bio), and Hunter.io free tier as last resort. Best-effort and non-blocking — for many small French TPE/artisans, no public pro email exists and a phone number alone is sufficient. Never fabricate addresses.
---

# Skill — Recherche email professionnel (deep search)

## Quand utiliser

Après le discovery Google Places + l'enrichissement API gouv, pour
tenter de trouver un email pro. **Best-effort, pas bloquant**.

Pour un artisan/TPE/coiffeur, un email pro public est **fréquemment
inexistant**. C'est OK : un téléphone valide suffit pour la prise
de contact.

## Ordre de recherche (s'arrêter au premier email pro crédible)

### 1. PRIORITAIRE — `/mentions-legales` du site (loi française)

**La loi française (LCEN art. 6-III)** oblige tout site commercial
français à publier dans ses mentions légales :

- Nom + prénom du responsable (pour personne physique) ou raison
  sociale et représentant légal (pour société)
- Adresse postale
- **Email de contact**
- **Téléphone**
- **SIRET / SIREN**
- Forme juridique, capital social, n° TVA intra (pour sociétés)

→ C'est la **source la plus fiable** pour récupérer email pro +
dirigeant + SIRET.

**URLs à tenter dans cet ordre** sur le `websiteUri` du prospect :

1. `<site>/mentions-legales`
2. `<site>/mentions-legales/`
3. `<site>/mentions`
4. `<site>/legal`
5. `<site>/legals`
6. `<site>/cgv` (les mentions sont parfois groupées avec les CGV)
7. `<site>/conditions-generales`
8. `<site>/footer` (parfois un lien dédié)
9. La homepage : footer (lien `Mentions légales` souvent présent)

Cherche avec WebFetch et extrais :

- Email : pattern `[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}`
- Filtre les emails perso (cf. liste plus bas)
- Téléphone : `^(\+33|0)[1-9](\s?\d{2}){4}$`
- SIRET : `\b\d{14}\b`
- Nom du gérant : souvent juste après "représenté(e) par" ou
  "directeur de la publication :" ou "responsable :"

### 2. Site web — page contact

`<site>/contact` — souvent un formulaire mais aussi un email visible
en clair ou en `mailto:`.

### 3. Page d'accueil — `mailto:` et footer

Fetch la homepage, cherche tous les `<a href="mailto:...">` et le
footer.

### 4. Pages Jaunes

`https://www.pagesjaunes.fr/recherche/<ville>/<activité>`

Cherche le nom commercial dans les résultats. La fiche détaillée peut
afficher un email pro (uniquement si le pro a payé pour le mettre,
mais ça arrive).

### 5. Facebook Business

Google search : `<nom entreprise> <ville> facebook` → fetch la première
URL `facebook.com/...` qui matche → cherche dans la section
"À propos" / "About" / "Informations" → champ "Email".

### 6. Instagram

Google search : `<nom entreprise> instagram` → fetch
`instagram.com/<handle>` → bio + lien externe (souvent un Linktree
ou un site web qui mène à un email).

### 7. Pappers.fr (publique, sans clé)

`https://www.pappers.fr/recherche?q=<nom entreprise>`

Pour confirmer SIREN + dirigeant. Email rarement présent mais ça
peut arriver sur les fiches détaillées.

### 8. (Optionnel) Hunter.io free tier — 25 recherches/mois

Si tu as un domaine pro mais pas trouvé d'email :

`GET https://api.hunter.io/v2/domain-search?domain=<domain>&api_key=<key>`

Ne consomme du quota que si vraiment indispensable. Skip si pas de
clé `HUNTER_API_KEY` configurée.

## Filtre obligatoire sur l'email trouvé

Email **rejeté** (= traité comme non-trouvé pro) si domaine dans :

    gmail.com, yahoo.com, yahoo.fr, hotmail.com, hotmail.fr,
    outlook.com, outlook.fr, icloud.com, free.fr, orange.fr,
    wanadoo.fr, laposte.net, sfr.fr, aol.com, live.com, live.fr,
    bbox.fr, neuf.fr, gmx.fr, gmx.com, protonmail.com, proton.me,
    me.com, mac.com

Dans ce cas :

- `email` reste `NULL` dans `lead_imports`
- Note dans `raw_payload.contact_email_personal: "<email perso>"`
- Mention dans `raw_payload.notes` : "Pas d'adresse pro publique,
  contact perso sur <provider> à valider à l'oral d'abord"

## Cas "rien trouvé"

Cas valide. Le prospect reste insérable s'il a au moins un téléphone.

- `email = NULL`
- `raw_payload.notes` mentionne "Pas d'email pro public — contact
  via téléphone."
- Le scoring Reach perd 0.3 mais reste >= 0.5 si le téléphone est
  trouvé.

## Règles strictes

- ❌ **JAMAIS inventer** un email basé sur supposition
  (ex `prenom.nom@<domaine>` deviné).
- ❌ Si un email apparaît dans une URL/lien social mais c'est un
  email perso, ne le mets PAS en `email`.
- ✅ Mets en minuscules systématiquement.
- ✅ Si plusieurs emails pro trouvés (ex `contact@` et `prenom@`),
  préfère celui qui correspond au dirigeant identifié, sinon
  `contact@` ou `info@`.
- ✅ Si tu trouves un SIRET dans /mentions-legales, ajoute-le aussi
  dans `raw_payload.siret` (peut servir si l'API gouv n'a pas matché).
