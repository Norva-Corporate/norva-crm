# Prompts d'agents multica.ai

Cette section contient les prompts système et les skills des agents
multica que Kylian utilise pour alimenter Norva CRM.

## Structure

    docs/agents/
    ├── README.md                         ← ce fichier
    ├── prospection-prompt.md             ← Agent Prospection
    ├── enrichissement-prompt.md          ← Agent Enrichissement
    ├── premier-contact-prompt.md         ← Agent Premier Contact
    └── skills/
        ├── prospection-google-places/SKILL.md
        ├── prospection-enrichment-gouv/SKILL.md
        ├── prospection-site-audit/SKILL.md
        ├── prospection-email-discovery/SKILL.md
        ├── prospection-scoring/SKILL.md
        ├── norva-leads-enrich/SKILL.md           ← UPDATE patterns
        ├── pain-digital-detection/SKILL.md       ← détecte le pain
        ├── redaction-cold-outreach/SKILL.md      ← rédige messages
        └── norva-supabase-insert/SKILL.md        ← INSERT générique

## Comment utiliser

### Le prompt principal

1. Ouvre `<agent>-prompt.md` dans VS Code
2. Sélectionne tout (Ctrl+A) → Copie (Ctrl+C)
3. Multica → l'agent → onglet **Instructions** → colle
4. Save

### Les skills

Chaque skill est un fichier `SKILL.md` autonome avec un front-matter
YAML (`name`, `description`) suivi du corps de la procédure.

**Pour les enregistrer dans multica** :

1. Section skills de multica → nouveau skill avec le `name` exact du
   front-matter
2. Colle le contenu du fichier (avec ou sans front-matter selon ce
   que multica accepte)
3. Sur l'agent → onglet **Skills** → "+ Attach" → coche les skills
   listées dans le tableau ci-dessous

## Pré-requis communs

Voir `docs/multica-integration.md`. Récap :

### Variables d'environnement (onglet Environment)

| Variable | Source | Pour quels agents |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | console.cloud.google.com (Places API) | Prospection, Enrichissement (optionnel) |
| `HUNTER_API_KEY` *(optionnel)* | hunter.io free tier | Prospection, Enrichissement |

### Custom Args (tous les agents)

    --mcp-config
    C:\Users\kylia\norva-mcp.json

### Fichier `~/norva-mcp.json`

Voir `docs/multica-integration.md` étape 2.

## Index des agents

| Agent multica | Sortie | Skills attachées |
|---------------|--------|------------------|
| **Agent Prospection** | INSERT `lead_imports` | google-places, enrichment-gouv, site-audit, email-discovery, scoring, supabase-insert |
| **Agent Enrichissement** | UPDATE `lead_imports`/`contacts`/`companies` + INSERT `activities` | leads-enrich, enrichment-gouv, email-discovery, site-audit, supabase-insert |
| **Agent Premier Contact** | INSERT `activities` (drafts) | pain-digital-detection, redaction-cold-outreach, supabase-insert |

## Roadmap d'agents (futurs)

Idées priorisées :

| # | Agent | Quand le construire |
|---|-------|---------------------|
| 4 | **Agent Suivi Pipeline** (relances auto sur deals stagnants) | Quand pipeline > 20 deals actifs |
| 5 | **Agent Réactivation Dormants** (récupère contacts >6 mois) | Quand base contacts > 100 |
| 6 | **Agent Onboarding Won** (setup projet auto sur deal gagné) | Quand >2 deals/mois gagnés |
| 7 | **Agent Devis Generator** (devis structuré depuis brief) | Quand le temps de prépa devis devient un goulot |
| 8 | **Agent Veille Signaux** (news/levée/recrutement sur companies) | Pour ABM ciblé sur PME tech |
