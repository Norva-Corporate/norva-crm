# Prompts d'agents multica.ai

Cette section contient les prompts système et les skills des agents
multica que Kylian utilise pour alimenter Norva CRM.

## Structure

    docs/agents/
    ├── README.md                      ← ce fichier
    ├── prospection-prompt.md          ← prompt principal (slim) Agent Prospection
    └── skills/
        ├── prospection-google-places/SKILL.md
        ├── prospection-site-audit/SKILL.md
        ├── prospection-email-discovery/SKILL.md
        ├── prospection-scoring/SKILL.md
        └── norva-supabase-insert/SKILL.md   ← réutilisable par tous les agents

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
   les 5 skills :
   - `prospection-google-places`
   - `prospection-site-audit`
   - `prospection-email-discovery`
   - `prospection-scoring`
   - `norva-supabase-insert`

> Si multica ne supporte pas le front-matter, supprime simplement
> les 4 lignes entre les `---` au début du fichier.

## Pré-requis communs

Voir `docs/multica-integration.md` pour la config complète. Récap :

### Variables d'environnement multica (onglet Environment de l'agent)

| Variable | Source | Pour quels agents |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | console.cloud.google.com | Prospection |

### Custom Args (onglet Custom Args de l'agent)

Deux lignes (ou une seule séparée par espace) :

    --mcp-config
    C:\Users\kylia\norva-mcp.json

### Fichier `~/norva-mcp.json` (sur la machine)

Voir `docs/multica-integration.md` étape 2.

## Index des agents

| Fichier | Agent multica | Sortie cible | Skills attachées |
|---------|---------------|--------------|------------------|
| `prospection-prompt.md` | Agent Prospection | `lead_imports` | les 5 skills ci-dessus |

Pour ajouter un nouvel agent (ex. enrichissement, suivi) : créer un
nouveau prompt principal dans `docs/agents/<nom>-prompt.md` qui
référence les skills réutilisables (typiquement `norva-supabase-insert`)
plus des skills spécifiques au métier.
