# Intégration multica.ai → Norva CRM

Procédure pour brancher un agent multica.ai sur la base Supabase de Norva,
afin que les sorties de l'agent (prospects scrapés, notes, brouillons,
etc.) atterrissent directement dans le CRM sans webhook ni copier-coller.

## Architecture

```
Toi (prompt) → agent multica → Claude runtime
                                  │
                                  ▼
                          MCP Supabase officiel
                                  │
                                  ▼
                      INSERT INTO lead_imports
                                  │
                                  ▼
                     /dashboard/leads (Norva)
```

L'agent utilise l'outil `mcp__supabase__execute_sql` pour écrire
directement dans la table `public.lead_imports`. Norva voit ensuite ces
lignes dans `/dashboard/leads` (onglet "À traiter") et tu les convertis
en contact + entreprise via le bouton "Convertir".

## Pré-requis (une seule fois)

### 1. Personal Access Token Supabase

1. Supabase Dashboard → avatar haut-droit → **Account**
2. Onglet **Access Tokens** → **Generate new token**
3. Nom : `Multica Agents`
4. Copie le token (`sbp_...`) — il ne réapparaîtra plus

### 2. Fichier de config MCP

Crée `%USERPROFILE%\norva-mcp.json` (Windows) ou `~/norva-mcp.json` :

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase",
        "--project-ref=ovaqjbbouvtexysxatro",
        "--features=database"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_TON_TOKEN"
      }
    }
  }
}
```

### 3. Vérification depuis Claude Code direct

```powershell
claude --mcp-config "$env:USERPROFILE\norva-mcp.json"
```

Dans la session, tape : `liste les tables de mon projet supabase`.
Tu dois voir 13 tables (companies, contacts, deals, …, lead_imports, …).

## Configuration d'un agent multica

Pour chaque agent qui doit écrire dans Norva :

### Onglet Custom Args

Ajoute :

```
--mcp-config C:\Users\<toi>\norva-mcp.json
```

(Sans guillemets si le chemin n'a pas d'espaces. Adapter le chemin sur
Mac/Linux si besoin.)

### Onglet Instructions

Inclure dans le prompt système :

> Tu as accès à un outil MCP Supabase appelé `mcp__supabase__execute_sql`.
> Utilise-le pour vérifier l'absence de doublons puis insérer les données
> dans `public.lead_imports` (voir schéma ci-dessous).

## Schéma `lead_imports`

| Colonne | Type | Notes |
|---|---|---|
| `source` | text | Toujours `'multica-<nom-agent>'` (ex `multica-prospection`) |
| `external_id` | text | ID stable (URL LinkedIn, SIRET, hash) — sert à la déduplication |
| `email` | text | En minuscules. NULL si pas trouvé. |
| `first_name`, `last_name` | text | Du contact principal |
| `phone` | text | Format international `+33...` de préférence |
| `role` | text | Fonction du contact |
| `company_name` | text | |
| `company_domain` | text | Domaine extrait de l'email pro. NULL pour gmail/yahoo/etc. |
| `raw_payload` | jsonb | TOUT le contexte enrichi (score, secteur, localisation, tags, notes…) |
| `status` | text | Auto `'pending'` à l'INSERT. Devient `'converted'` / `'dismissed'` côté UI. |

**Règle anti-doublon obligatoire** : avant chaque INSERT,

```sql
SELECT id FROM public.lead_imports
WHERE source = 'multica-<nom>'
  AND (external_id = '<id>' OR lower(email) = lower('<email>'));

SELECT id FROM public.contacts WHERE lower(email) = lower('<email>');
```

Si un match → SKIP, n'insère pas.

## Convention `raw_payload`

JSON valide. Clés recommandées (toutes optionnelles sauf indication) :

```json
{
  "score": 0.78,
  "priority": "Oui",
  "score_breakdown": {
    "fit": 0.85,
    "pain": 0.7,
    "reach": 0.9,
    "budget": 0.6
  },
  "sector": "Coiffure",
  "location": "Lyon 6e",
  "address": "12 rue de la République, 69006 Lyon",
  "linkedin": "https://www.linkedin.com/in/...",
  "website": "https://salon-acme.fr",
  "siret": "12345678901234",
  "estimated_value_eur": 3500,
  "next_followup_date": "2026-05-20",
  "tags": ["TPE", "Sans site web", "Haute priorité"],
  "notes": "Justification du score + contexte (signal observé, source).",
  "sources": ["google-maps", "pages-jaunes", "pappers"],
  "scraped_at": "2026-05-06T20:30:00Z"
}
```

## Workflow utilisateur

1. **Toi** : prompt l'agent multica avec la cible (`5 coiffeurs sans site
   web à Lyon`)
2. **Agent** : recherche, qualifie, score, INSERT dans `lead_imports`
3. **Agent** : retourne un récap markdown
4. **Toi** : ouvre `/dashboard/leads` → onglet "À traiter"
5. **Toi** : pour chaque lead pertinent, clique "Convertir" → drawer →
   ajuste si besoin → crée contact + company en un clic
6. **Norva** : marque `lead_imports.status='converted'` automatiquement

## Avantages vs webhook HTTP

| | Webhook HTTP | MCP Supabase |
|---|---|---|
| Quoting JSON | Fragile (PowerShell/curl) | Géré par l'agent |
| Auth | Secret partagé custom | PAT Supabase natif |
| Erreurs | Stack 500 difficile à voir | Erreur SQL claire |
| Format | Schéma webhook strict | SQL flexible |
| Ajout d'autres tables | Non sans dev | `execute_sql` arbitraire |

## Ajout d'un nouvel agent

Pour brancher un agent supplémentaire (suivi, enrichissement, etc.) :

1. Ajoute le même `--mcp-config` dans Custom Args
2. Inclure l'instruction MCP dans le prompt système
3. Adapter le `source` de l'INSERT (ex `multica-suivi`, `multica-enrichissement`)
4. Eventuellement écrire dans d'autres tables (`activities`, `tasks`, `notifications`)
   — utiliser le même `mcp__supabase__execute_sql` avec le bon SQL.

## Dépannage

| Symptôme | Cause probable | Fix |
|---|---|---|
| Agent dit `mcp__supabase__* not found` | `--mcp-config` pas passé au runtime | Vérifier Custom Args, sauver, relancer |
| `SUPABASE_ACCESS_TOKEN` manquant | Env vars MCP non chargées | Vérifier le bloc `env` du JSON |
| `permission denied for table` | RLS active sur la table | Le PAT doit être lié à un user qui a le bon rôle, ou utiliser `--features=database` qui passe en mode service |
| Doublons quand même | `external_id` non stable | Privilégier URL LinkedIn ou SIRET, pas un nom |
