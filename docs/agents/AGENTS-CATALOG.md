# Liste des agents Norva — référence complète

Ce document liste **tous les agents multica** prévus pour Norva CRM,
avec leur fonction principale, leur trigger, leurs sources de données
et leur statut.

## ✅ Agents en place (5)

### 1. Agent Prospection 🔍

**Fonction** : Découvre de nouveaux prospects (artisans, TPE, commerces
locaux, petites startups FR) selon des critères de ciblage donnés,
les qualifie sur 4 axes (Fit/Pain/Reach/Budget) et les insère dans
`lead_imports`.

- **Trigger** : Manuel dans multica, prompt avec critère
  *(ex. "5 coiffeurs sans site à Lyon")*
- **Sources** : Google Places API, API gouv FR (recherche-entreprises),
  mentions légales des sites, Pages Jaunes, Pappers, Hunter.io
  (optionnel)
- **Sortie** : INSERT `lead_imports` avec `source='multica-prospection'`
- **Volume** : 5-20 prospects par run
- **Skills** : google-places, enrichment-gouv, site-audit,
  email-discovery, scoring, supabase-insert
- **Prompt** : `docs/agents/prospection-prompt.md`

### 2. Agent Enrichissement 🪄

**Fonction** : Complète les leads/contacts/companies incomplets en
récupérant via les sources publiques gratuites les champs manquants
(dirigeant, email pro, SIRET, secteur, taille).

- **Trigger** : Bouton 🪄 sur ligne lead pending dans
  `/dashboard/leads`, ou manuel
- **Sources** : API gouv FR, mentions légales, Pages Jaunes, Hunter.io
- **Sortie** : UPDATE in-place sur `lead_imports`/`contacts`/`companies`
  + INSERT activity de trace (sauf pour leads)
- **Skills** : leads-enrich, enrichment-gouv, email-discovery,
  site-audit, supabase-insert, agent-queue
- **Prompt** : `docs/agents/enrichissement-prompt.md`

### 3. Agent Premier Contact ✉️

**Fonction** : Génère un kit de prise de contact personnalisé pour un
prospect : 4 variantes (script tel, email cold, message LinkedIn, SMS
post-appel manqué). Adapte le ton selon le secteur (tutoiement
artisans, vouvoiement libéraux/tech).

- **Trigger** : Bouton ✨ "Kit premier contact" sur fiche contact
- **Sources** : Données du contact + raw_payload + secteur
- **Sortie** : INSERT 4 `activities` `draft: true` sur le contact
- **Skills** : pain-digital-detection, redaction-cold-outreach,
  supabase-insert, agent-queue
- **Prompt** : `docs/agents/premier-contact-prompt.md`

### 4. Agent Audit Site 🌐

**Fonction** : Audit complet du site web d'un prospect (HTTPS,
mobile-friendly, prise de RDV, tarifs, plateforme, vitesse). Génère
un rapport markdown structuré pour préparer un appel commercial
avec arguments concrets.

- **Trigger** : Bouton ✨ "Auditer le site" sur fiche contact
- **Sources** : WebFetch sur la homepage + 3 pages internes
  (contact/tarifs/équipe)
- **Sortie** : INSERT 1 activity `type=note` avec rapport markdown
- **Skills** : site-audit, supabase-insert, agent-queue
- **Prompt** : `docs/agents/audit-site-prompt.md`

### 5. Agent Re-scoring Deal 🎯

**Fonction** : Re-évalue le score d'un deal en pipeline en tenant
compte des activités récentes (notes, appels, emails) et des données
enrichies (site audit, présence Google) qui ont pu changer depuis la
création du deal.

- **Trigger** : Bouton ✨ "Re-scorer ce deal" dans le drawer du
  pipeline
- **Sources** : Données du deal + contact + company + activities 30j
- **Sortie** : INSERT 1 activity `type=note` sur le deal avec le
  nouveau breakdown (jamais d'UPDATE des colonnes du deal)
- **Skills** : scoring, supabase-insert, agent-queue
- **Prompt** : `docs/agents/rescoring-deal-prompt.md`

---

## 🚧 Agents roadmap (à construire plus tard)

### 6. Agent Suivi Pipeline 📅

**Fonction** : Tourne quotidiennement. Détecte les deals stagnants
(>7 jours sans activité ni changement de stage), crée des tâches
"Relancer prospect Y" avec due_date à demain. Notifie via la cloche.

- **Trigger** : Manuel chaque matin, ou via cron multica si dispo
- **Sources** : Lecture `deals` + `activities`
- **Sortie** : INSERT `tasks` + `notifications`
- **À construire quand** : pipeline > 20 deals actifs
- **Pré-requis** : aucun, déclenchable directement

### 7. Agent Réactivation Dormants 💤

**Fonction** : Mensuel. Trouve les contacts pas touchés depuis 6 mois
mais qui avaient un bon score initial. Génère un message de
réactivation personnalisé tenant compte du temps écoulé et des
nouveautés Norva (nouveaux services, cas client, etc.).

- **Trigger** : Manuel mensuel
- **Sources** : `contacts` + `activities` + raw_payload
- **Sortie** : INSERT 1 `activity` type `email` `draft: true`
- **À construire quand** : base contacts > 100
- **Pré-requis** : Premier Contact en place (réutilise
  redaction-cold-outreach)

### 8. Agent Onboarding Won 🎉

**Fonction** : Au moment où un deal passe `won`, génère
automatiquement la checklist projet (5-10 tasks types : kickoff,
accès comptes clients, brief design, devis final, etc.) liées au
projet auto-créé. Brouillon d'email de bienvenue inclus.

- **Trigger** : Auto sur changement de stage (à brancher via
  trigger Postgres → INSERT agent_task), ou manuel
- **Sources** : Le deal won + son contact + sa company
- **Sortie** : INSERT 5-10 `tasks` + 1 `activity` type=email
  (welcome draft)
- **À construire quand** : >2 deals/mois gagnés
- **Pré-requis** : déclenchement automatique sur deal `won`

### 9. Agent Devis Generator 💶

**Fonction** : À partir d'un brief texte (et le deal existant),
génère des line items structurés (intitulé + qté + prix) pour les
prestations Norva (site web vitrine/e-com, refonte, SEO local,
module RDV) et crée une `invoice` (type=quote, status=brouillon).

- **Trigger** : Bouton ✨ "Générer devis" dans le drawer du deal,
  ou manuel
- **Sources** : Le deal + brief utilisateur dans `task.context.brief`
- **Sortie** : INSERT 1 `invoice` (type=quote) + ses `invoice_items`
- **À construire quand** : le temps de prépa devis devient un goulot
- **Pré-requis** : avoir une grille tarifaire interne (à formaliser
  d'abord)

### 10. Agent Veille Signaux 📡

**Fonction** : Pour les contacts/companies en pipeline `qualified+`,
scrape Google News + LinkedIn pour détecter levée de fonds, ouverture
de site, recrutements, déménagement, etc. → ajoute `activity` type
"Signal détecté" avec lien source.

- **Trigger** : Hebdo manuel
- **Sources** : Google News, LinkedIn entreprise, Pappers (changements
  de gérant/effectif)
- **Sortie** : INSERT activities sur les contacts/companies concernés
- **À construire quand** : ABM ciblé sur PME tech (moins utile pour
  artisans)
- **Pré-requis** : aucun, autonome

---

## Séquence de déploiement recommandée

| Phase | Agents à activer | Pourquoi maintenant |
|-------|------------------|---------------------|
| **1 — Acquisition** *(actuel)* | Prospection, Enrichissement | Remplit le funnel |
| **2 — Conversion** *(actuel)* | Premier Contact, Audit Site, Re-scoring | Transforme les prospects |
| **3 — Suivi** | Suivi Pipeline | Évite les pertes par négligence |
| **4 — Industrialisation** | Onboarding Won, Devis Generator | Quand tu signes 2+/mois |
| **5 — Amplification** | Réactivation Dormants, Veille Signaux | Quand la base est large |

---

## Convention de nommage des sources

Chaque agent doit utiliser un identifiant unique pour le champ
`source` lors des INSERTs :

| Agent | Source |
|-------|--------|
| Prospection | `multica-prospection` |
| Enrichissement | n/a (UPDATE en place) |
| Premier Contact | n/a (INSERT activities) |
| Audit Site | n/a (INSERT activity) |
| Re-scoring Deal | n/a (INSERT activity) |
| Suivi Pipeline | n/a (INSERT tasks) |
| Réactivation | n/a (INSERT activity) |
| Onboarding Won | n/a (INSERT tasks) |
| Devis Generator | n/a (INSERT invoice) |
| Veille Signaux | n/a (INSERT activities) |

Les agents qui INSERT dans `activities` mettent leur identité dans
`payload.agent` (ex. `"agent": "multica-rescoring-deal"`) pour la
traçabilité.
