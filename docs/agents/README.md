# Prompts d'agents multica.ai

Cette section contient les prompts système et les skills des agents
multica que Kylian utilise pour alimenter Norva CRM.

## Structure

    docs/agents/
    ├── README.md                      ← ce fichier
    ├── prospection-prompt.md          ← prompt principal (slim)
    └── skills/
        ├── prospection-google-places/SKILL.md
        ├── prospection-enrichment-gouv/SKILL.md   ← NEW (gérant + SIREN gratuit)
        ├── prospection-site-audit/SKILL.md
        ├── prospection-email-discovery/SKILL.md   ← deep search (mentions légales)
        ├── prospection-scoring/SKILL.md
        └── norva-supabase-insert/SKILL.md         ← réutilisable par tous les agents

## Comment utiliser

### 1. Le prompt principal

1. Ouvre `prospection-prompt.md` dans VS Code
2. Sélectionne tout (Ctrl+A) → Copie (Ctrl+C)
3. Multica → Agent Prospection → onglet **Instructions** → colle
4. Save

### 2. Les skills

Chaque skill est un fichier `SKILL.md` autonome avec un front-matter
YAML (`name`, `description`) suivi du corps de la procédure.

**Pour les enregistrer dans multica** :

1. Dans multica, va dans la section qui gère tes skills (probablement
   accessible depuis ton compte ou via l'agent → bouton "+ Attach"
   dans la zone Skills)
2. Crée un nouveau skill, donne-lui le même `name` que dans le
   front-matter du `SKILL.md`
3. Colle le contenu du fichier (avec ou sans le front-matter selon
   ce que multica accepte)
4. Sauvegarde
5. Sur l'agent Prospection → onglet **Skills** → "+ Attach" → choisis
   les 6 skills

> Si multica ne supporte pas le front-matter, supprime simplement
> les 4 lignes entre les `---` au début du fichier.

## Pré-requis communs

Voir `docs/multica-integration.md` pour la config complète. Récap :

### Variables d'environnement multica (onglet Environment de l'agent)

| Variable | Source | Pour quels agents |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | console.cloud.google.com (Places API) | Prospection |
| `HUNTER_API_KEY` *(optionnel)* | hunter.io (free tier 25/mois) | Prospection (fallback email) |

### Custom Args (onglet Custom Args de l'agent)

Deux lignes (ou une seule séparée par espace) :

    --mcp-config
    C:\Users\kylia\norva-mcp.json

### Fichier `~/norva-mcp.json` (sur la machine)

Voir `docs/multica-integration.md` étape 2.

## Sources de données utilisées (par ordre de priorité)

### Gratuites, sans clé API, illimitées

1. **API Recherche Entreprises (data.gouv.fr)** —
   `recherche-entreprises.api.gouv.fr` — SIREN, dirigeants, NAF,
   effectif. **Source officielle gouv FR**, 7 req/sec, totalement
   gratuit.
2. **Mentions légales du site prospect** — obligatoires en France
   (loi LCEN). Email + SIRET + dirigeant garantis si le pro a un site.
3. **Pages Jaunes** — annuaire pro français. Scraping via WebFetch.

### Gratuites avec clé / quota

4. **Google Places API (New)** — 200 $/mois de crédit gratuit Google
   Cloud, soit ~6000 recherches Text Search/mois.
5. **Hunter.io** — 25 recherches d'email/mois gratuit (fallback).

### Réseaux sociaux (scraping public)

6. **Facebook Business** (section À propos)
7. **Instagram** (bio + lien externe)

### Payantes (à éviter au max pour le ROI)

- **Pappers.fr API** — gratuit jusqu'à 100 req/jour, payant après.
  Pas indispensable car l'API gouv couvre l'essentiel.
- **Dropcontact** — payant, pour enrichir les emails à grande échelle.
- **Apollo.io** — payant, base B2B internationale.

## Index des agents

| Fichier | Agent multica | Sortie cible | Skills attachées |
|---------|---------------|--------------|------------------|
| `prospection-prompt.md` | Agent Prospection | `lead_imports` | les 6 skills ci-dessus |

Pour ajouter un nouvel agent (ex. enrichissement, suivi) : créer un
nouveau prompt principal dans `docs/agents/<nom>-prompt.md` qui
référence les skills réutilisables (`norva-supabase-insert`,
éventuellement `prospection-enrichment-gouv` aussi) plus des skills
spécifiques au métier.
