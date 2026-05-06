# Prompts d'agents multica.ai

Cette section contient les prompts système et les skills des agents
multica que Kylian utilise pour alimenter Norva CRM. Tous les agents
peuvent être déclenchés :

- **manuellement** dans multica avec un prompt
- **depuis le bouton ✨ dans Norva** (queue table `agent_tasks`)

## Structure

    docs/agents/
    ├── README.md                         ← ce fichier
    ├── prospection-prompt.md             ← Agent Prospection
    ├── enrichissement-prompt.md          ← Agent Enrichissement
    ├── premier-contact-prompt.md         ← Agent Premier Contact
    ├── audit-site-prompt.md              ← Agent Audit Site
    ├── rescoring-deal-prompt.md          ← Agent Re-scoring Deal
    └── skills/
        ├── prospection-google-places/
        ├── prospection-enrichment-gouv/
        ├── prospection-site-audit/
        ├── prospection-email-discovery/
        ├── prospection-scoring/
        ├── norva-leads-enrich/
        ├── norva-agent-queue/                ← NEW : pull/claim/done
        ├── pain-digital-detection/
        ├── redaction-cold-outreach/
        └── norva-supabase-insert/

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

| Agent | Bouton dans Norva | Sortie |
|-------|-------------------|--------|
| **Prospection** | (manuel uniquement, lance la session) | `lead_imports` (INSERT) |
| **Enrichissement** | Bouton "Wand" sur ligne lead pending dans `/dashboard/leads` | UPDATE `lead_imports` ou `contacts`/`companies` |
| **Premier Contact** | Bouton "Kit premier contact" sur fiche contact | INSERT 4 `activities` (drafts) |
| **Audit Site** | Bouton "Auditer le site" sur fiche contact | INSERT `activity` type=note (rapport markdown) |
| **Re-scoring Deal** | Bouton "Re-scorer ce deal" dans le drawer du pipeline | INSERT `activity` sur le deal |

## Pré-requis communs

Voir `docs/multica-integration.md`. Récap rapide :

### Variables d'environnement (onglet Environment de chaque agent)

| Variable | Source | Pour quels agents |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | console.cloud.google.com | Prospection (et fallback Enrichissement) |
| `HUNTER_API_KEY` *(optionnel)* | hunter.io free tier | Email discovery |

### Custom Args (tous les agents)

    --mcp-config
    C:\Users\kylia\norva-mcp.json

### Fichier `~/norva-mcp.json`

Voir `docs/multica-integration.md` étape 2.

### Skill `norva-agent-queue` à attacher SI tu veux le mode queue

Tous les agents qui ont un bouton dans Norva doivent attacher ce skill
en plus de leurs skills métier.

## Index des agents (skills à attacher)

| Agent | Skills métier | Skills transverses |
|-------|---------------|---------------------|
| Prospection | google-places, enrichment-gouv, site-audit, email-discovery, scoring | norva-supabase-insert |
| Enrichissement | leads-enrich, enrichment-gouv, email-discovery, site-audit | **norva-agent-queue**, norva-supabase-insert |
| Premier Contact | pain-digital-detection, redaction-cold-outreach | **norva-agent-queue**, norva-supabase-insert |
| Audit Site | site-audit | **norva-agent-queue**, norva-supabase-insert |
| Re-scoring Deal | scoring | **norva-agent-queue**, norva-supabase-insert |

## Roadmap d'agents (futurs)

| # | Agent | Quand le construire |
|---|-------|---------------------|
| 4 | **Suivi Pipeline** (relances auto sur deals stagnants) | Quand pipeline > 20 deals actifs |
| 5 | **Réactivation Dormants** | Quand base contacts > 100 |
| 6 | **Onboarding Won** | Quand >2 deals/mois gagnés |
| 7 | **Devis Generator** | Quand le temps de prépa devis devient un goulot |
| 8 | **Veille Signaux** (news/levée/recrutement) | Pour ABM ciblé sur PME tech |
