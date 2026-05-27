# Prompts d'agents multica.ai

Cette section contient les prompts système et les skills des agents
multica que Kylian utilise pour alimenter Norva CRM. Tous les agents
peuvent être déclenchés :

- **manuellement** dans multica avec un prompt
- **depuis le bouton ✨ dans Norva** (queue table `agent_tasks`)

Le runtime AI utilisé est **Claude Code** (seul runtime Multica qui lit
réellement `--mcp-config`, donc seul à pouvoir parler à Supabase via MCP).

## Structure

    docs/agents/
    ├── README.md                         ← ce fichier
    ├── AGENTS-CATALOG.md                 ← référence complète + roadmap + phase 2
    ├── lead-intake-prompt.md             ← Agent Lead Intake (prospection + vérif)
    ├── enrichissement-prompt.md          ← Agent Enrichissement (queue uniquement)
    ├── premier-contact-prompt.md         ← Agent Premier Contact
    ├── audit-site-prompt.md              ← Agent Audit Site
    ├── rescoring-deal-prompt.md          ← Agent Re-scoring Deal
    ├── logos/                            ← 5 SVG (1 par agent)
    └── skills/
        ├── norva-agent-queue/                ← pull/claim/done (transverse)
        ├── norva-supabase-insert/            ← INSERT patterns (transverse)
        ├── prospection-scoring/              ← source unique du framework 4 axes
        ├── prospection-google-places/        ← discovery
        ├── prospection-enrichment-gouv/      ← API gouv recherche-entreprises
        ├── prospection-sirene/               ← INSEE Sirene v3 (fallback strict)
        ├── prospection-pappers/              ← Pappers free (signal Budget)
        ├── prospection-bodacc-check/         ← entreprise vivante
        ├── prospection-email-discovery/      ← deep search email
        ├── prospection-email-verification/   ← deliverability MX + Hunter + Mailboxlayer
        ├── prospection-pagespeed-check/      ← perf site mobile
        ├── prospection-site-audit/           ← drapeaux qualitatifs site
        ├── pain-digital-detection/           ← top-1 pain prospect
        ├── redaction-cold-outreach/          ← 4 variantes message
        └── signaux-google-news/              ← détection signaux entreprise

## Le pattern queue (depuis Norva)

```
[Bouton ✨ dans Norva (fiche contact, deal drawer, ligne lead)]
        ↓
[Server action enqueueAgentTask → INSERT public.agent_tasks pending]
        ↓
[Toast "Tâche en file"]
        ↓
[Tu ouvres multica → Run sur l'agent correspondant (1 clic, sans prompt)]
        ↓
[Skill norva-agent-queue : claim pending tasks (UPDATE running) → traite → UPDATE done]
        ↓
[Realtime push vers Norva → AgentTasksPanel et fiche se rafraîchissent]
```

Friction : 2 clics (Norva + multica) au lieu de retaper le prompt à
chaque fois. Et tu peux mettre en file plusieurs tâches puis tout
exécuter en un run.

## Agents disponibles et où les déclencher

| # | Agent | Bouton dans Norva | Sortie |
|---|-------|-------------------|--------|
| 1 | **Lead Intake** | (manuel uniquement, lance la session avec un critère) | INSERT `lead_imports` avec `pipeline_stage='verified'` |
| 2 | **Enrichissement** | Bouton 🪄 sur ligne lead pending dans `/dashboard/leads` | UPDATE `lead_imports` ou `contacts`/`companies` |
| 3 | **Premier Contact** | Bouton ✨ "Kit premier contact" sur fiche contact | INSERT 4 `activities` (drafts : call, email, linkedin, sms) |
| 4 | **Audit Site** | Bouton ✨ "Auditer le site" sur fiche contact | INSERT `activity` type=note (rapport markdown) |
| 5 | **Re-scoring Deal** | Bouton ✨ "Re-scorer ce deal" dans le drawer du pipeline | INSERT `activity` sur le deal (jamais d'UPDATE colonnes deal) |

## Pré-requis communs

Voir [docs/multica-integration.md](../multica-integration.md). Récap rapide :

### Variables d'environnement (onglet Environment de chaque agent)

| Variable | Source | Pour quels agents | Statut |
|---|---|---|---|
| `GOOGLE_MAPS_API_KEY` | console.cloud.google.com (Places API) | Lead Intake | Obligatoire |
| `HUNTER_API_KEY` | hunter.io free tier (25/mois) | Lead Intake, Enrichissement | Optionnelle |
| `MAILBOXLAYER_API_KEY` | mailboxlayer.com free tier (100/mois) | Lead Intake, Enrichissement | Optionnelle |
| `GOOGLE_PAGESPEED_KEY` | console.cloud.google.com (PageSpeed) | Lead Intake, Enrichissement | Optionnelle (augmente quota) |
| `PAPPERS_API_KEY` | pappers.fr free tier (100/jour) | Lead Intake, Enrichissement | Optionnelle (signal Budget) |
| `SIRENE_API_TOKEN` | api.insee.fr (gratuit illimité) | Lead Intake, Enrichissement | Optionnelle (fallback strict) |

### Custom Args (tous les agents)

    --mcp-config
    C:\Users\kylia\norva-mcp.json

### Fichier `~/norva-mcp.json`

Voir [docs/multica-integration.md](../multica-integration.md) étape 2.

### Skill `norva-agent-queue` à attacher SI tu veux le mode queue

Tous les agents qui ont un bouton dans Norva doivent attacher ce skill
en plus de leurs skills métier (les 4 agents queue-driven :
Enrichissement, Premier Contact, Audit Site, Re-scoring Deal).

Lead Intake n'utilise PAS la queue — il se lance manuellement avec un
critère ("5 coiffeurs à Lyon 6e").

## Index des agents (skills à attacher)

| Agent | Skills métier | Skills transverses |
|-------|---------------|---------------------|
| **Lead Intake** | google-places, enrichment-gouv, bodacc-check, site-audit, pagespeed-check, email-discovery, email-verification, scoring | norva-supabase-insert |
| **Enrichissement** | enrichment-gouv, **sirene**, **pappers**, email-discovery, email-verification, bodacc-check, site-audit, pagespeed-check, scoring | **norva-agent-queue**, norva-supabase-insert |
| **Premier Contact** | pain-digital-detection, redaction-cold-outreach | **norva-agent-queue**, norva-supabase-insert |
| **Audit Site** | site-audit | **norva-agent-queue**, norva-supabase-insert |
| **Re-scoring Deal** | scoring, **signaux-google-news** | **norva-agent-queue**, norva-supabase-insert |

Les skills en **gras** sont les ajouts récents (refonte rework 2026).

> ⚠️ **`prospection-sirene` et `prospection-pappers` ne sont PAS attachées
> au Lead Intake** par défaut — la combinaison des 11 skills initialement
> prévues dépassait la fenêtre de contexte du modèle Claude. Elles
> restent disponibles sur l'Agent Enrichissement (mode queue, 1 lead à
> la fois, contexte plus léger). Si un lead a besoin d'un signal Budget
> enrichi (Pappers) ou d'un fallback strict INSEE (Sirene), passe-le
> par Enrichissement (bouton 🪄) après l'import.

## Roadmap d'agents (futurs)

> **Phase 2 (après calibration)** : passage en Autopilots Multica
> (cron / webhook pour lancement automatique) et constitution d'une
> Squad `Norva Sales Ops` (dispatcher leader unique qui route vers les
> spécialistes). Détails dans [AGENTS-CATALOG.md](AGENTS-CATALOG.md)
> section *Évolutions Multica*.

| # | Agent | Quand le construire |
|---|-------|---------------------|
| 6 | **Suivi Pipeline** (relances auto sur deals stagnants) | Quand pipeline > 20 deals actifs |
| 7 | **Réactivation Dormants** | Quand base contacts > 100 |
| 8 | **Onboarding Won** | Quand >2 deals/mois gagnés |
| 9 | **Devis Generator** | Quand le temps de prépa devis devient un goulot |
| 10 | **Veille Signaux** (news/levée/recrutement) | Pour ABM ciblé sur PME tech (réutilise `signaux-google-news`) |
