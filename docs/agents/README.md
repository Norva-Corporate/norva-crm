# Prompts d'agents multica.ai

Cette section contient les prompts système des agents multica que Kylian
utilise pour alimenter Norva CRM.

## Comment les utiliser

1. Ouvre le fichier `.md` correspondant à l'agent dans VS Code
   (ou n'importe quel éditeur qui ne mange pas le formatage)
2. **Sélectionne tout le contenu** (Ctrl+A) puis copie (Ctrl+C)
3. Dans multica → onglet **Instructions** de l'agent → colle (Ctrl+V)
4. Sauvegarde

> ⚠️ Évite de copier depuis un message de chat (les blocs code
> imbriqués peuvent perdre des éléments). Toujours depuis le fichier
> source.

## Pré-requis pour tous ces agents

Voir `docs/multica-integration.md` pour la config MCP Supabase et les
variables d'environnement nécessaires.

Variables d'env communes à mettre dans l'onglet **Environment** :

| Variable | Source | Pour quels agents |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | console.cloud.google.com | Prospection |
| `SUPABASE_ACCESS_TOKEN` | déjà dans `~/norva-mcp.json` | tous |

Custom Args pour tous :

    --mcp-config C:\Users\<toi>\norva-mcp.json

## Index des agents

| Fichier | Agent | Sortie cible | Statut |
|---|---|---|---|
| `prospection-prompt.md` | Agent Prospection | `lead_imports` | ✅ Actif |
