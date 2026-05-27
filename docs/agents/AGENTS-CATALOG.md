# Liste des agents Norva — référence complète

Ce document liste **tous les agents multica** prévus pour Norva CRM,
avec leur fonction principale, leur trigger, leurs sources de données
et leur statut.

## ✅ Agents en place (5)

### 1. Agent Lead Intake 🎯 *(remplace Prospection + Enrichissement batch)*

**Fonction** : Agent unifié de prospection + vérification. Découvre
de nouveaux prospects (TPE/artisans/commerces/professions libérales
0-49 salariés), les enrichit (dirigeant, SIRET, effectif), **vérifie
toutes les données** (email deliverable, LinkedIn match, BODACC entreprise
active, perf site PageSpeed), score sur 4 axes recalibrés TPE, et insère
dans `lead_imports` avec `pipeline_stage='verified'` directement. **UNE
seule passe, leads "verts" prêts à examiner.**

- **Trigger** : Manuel dans multica, prompt avec critère
  *(ex. "5 coiffeurs sans site à Lyon 6e", "10 plombiers sur Lille")*
- **Sources** : Google Places API, API gouv FR (recherche-entreprises),
  BODACC opendatasoft (radiation/liquidation), Google PageSpeed Insights,
  Hunter.io free, Mailboxlayer free, DNS MX, LinkedIn (Google search
  + scraping public), mentions légales, Pages Jaunes, Pappers
- **Sortie** : INSERT `lead_imports` avec `source='multica-lead-intake'`,
  `pipeline_stage='verified'`, `quality_score`, `email_verified`,
  `linkedin_verified`, `company_active`, `pagespeed_score` tous remplis
- **Volume** : 5-15 prospects par run (qualité > quantité)
- **Skills** : google-places, enrichment-gouv, bodacc-check, site-audit,
  pagespeed-check, email-discovery, email-verification, scoring (TPE
  recalibré, source unique du framework), supabase-insert
- ⚠️ **Note context window** : `prospection-sirene` et
  `prospection-pappers` ne sont pas attachées par défaut (dépassement
  fenêtre Claude). Pour les exploiter, faire passer le lead par
  l'Agent Enrichissement après import.
- **Prompt** : `docs/agents/lead-intake-prompt.md`

### 2. Agent Enrichissement 🪄 *(mode queue uniquement)*

**Fonction** : Re-enrichit un lead/contact/company existant à la demande
de l'utilisateur (bouton 🪄). Sert pour les leads importés AVANT le
pipeline Lead Intake, ou pour rafraîchir des données vieilles
(> 60 jours).

**Pour les nouveaux prospects, utiliser Lead Intake à la place.**

L'ancien mode BATCH (rafraîchissement massif manuel) a été supprimé.
Pour les rafraîchissements en lot, voir la section *Évolutions Multica
à activer en phase 2* en bas de ce document (Autopilot
"Enrichissement nocturne").

- **Trigger** : Bouton 🪄 sur ligne lead dans `/dashboard/leads` (queue
  `agent_tasks`)
- **Sources** : API gouv FR, Sirene v3 INSEE, Pappers free, BODACC,
  mentions légales, Hunter.io, Mailboxlayer
- **Sortie** : UPDATE in-place sur `lead_imports`/`contacts`/`companies`
  + INSERT activity de trace (sauf pour leads, où on enrichit
  `raw_payload.enrichment_log`)
- **Skills** : enrichment-gouv, **sirene**, **pappers**, email-discovery,
  email-verification, bodacc-check, site-audit, pagespeed-check, scoring,
  supabase-insert, agent-queue
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
  + **signaux Google News** (levée de fonds, recrutements, expansion
  depuis le dernier scoring)
- **Sortie** : INSERT 1 activity `type=note` sur le deal avec le
  nouveau breakdown (jamais d'UPDATE des colonnes du deal)
- **Skills** : scoring, **signaux-google-news**, supabase-insert,
  agent-queue
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
| Lead Intake | `multica-lead-intake` |
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

---

## 📡 Évolutions Multica à activer en phase 2

Multica a introduit des features qu'on n'exploite pas encore et qui
permettront d'automatiser ce qui est aujourd'hui manuel. **À activer
seulement quand les 5 agents actuels sont bien calibrés** (= taux de
SKIP stable, `quality_score` moyen ≥ 70 sur les inserts, peu de bugs
remontés). Sinon on automatise du bruit.

### Autopilots (cron / webhook / manuel)

Un Autopilot Multica exécute un agent automatiquement selon un trigger.
Granularité cron à la minute, webhooks limités à 60 req/min et 256 KiB.
Les erreurs ne sont **pas** auto-relancées — il faut surveiller.

| Autopilot proposé | Trigger | Agent appelé | Quand l'activer |
|---|---|---|---|
| **Enrichissement nocturne** | Cron quotidien 3h UTC | Enrichissement | Quand > 50 leads en base avec `verified_at` qui vieillit |
| **Alertes BODACC** | Cron hebdo (lundi 6h UTC) | Enrichissement (focus BODACC) | Dès qu'on a un pipeline `qualified` ≥ 10 deals |
| **Suivi Pipeline** | Cron quotidien 8h UTC | Agent #6 (à construire) | Quand pipeline > 20 deals actifs |
| **Veille Signaux** | Cron hebdo | Agent #10 (à construire) | Pour ABM ciblé sur PME tech |

Le mode BATCH manuel de l'Agent Enrichissement (supprimé dans le
rework) sera remplacé par l'Autopilot "Enrichissement nocturne" :
un trigger Postgres alimente `agent_tasks` avec les leads dont
`verified_at > 60 jours`, et l'Autopilot claim cette queue chaque nuit.

### Squads (multi-agents orchestrés)

Une Squad Multica = un agent **leader** qui reçoit l'assignation et
route vers le membre spécialisé via `@-mention`. Architecture
centralisée (pas de peer-to-peer).

**Squad proposée : `Norva Sales Ops`**

- **Leader** : nouvel agent "Norva Dispatcher" (créé spécifiquement
  pour la Squad, instruction unique = router)
- **Membres** : Lead Intake, Enrichissement, Premier Contact,
  Audit Site, Re-scoring Deal
- **Cas d'usage** : tu poses une demande générique
  ("traite à fond le prospect Salon Marie Lyon 6e") et le leader
  enchaîne Lead Intake → Premier Contact → Audit Site
- **À activer quand** : les 5 agents individuels donnent des résultats
  fiables (pas avant)

### Conditions pré-activation phase 2

À vérifier avant de basculer en Autopilots/Squads :

- [ ] `quality_score` moyen sur 30 derniers inserts Lead Intake ≥ 70
- [ ] Taux SKIP étape 11 stable et compris (pas explosif)
- [ ] Aucune erreur récurrente dans les logs `agent_tasks.error`
- [ ] Variables d'env optionnelles (Pappers, Sirene, PageSpeed) en place
- [ ] Au moins 10 leads passés par chaque agent en mode manuel
- [ ] Backup régulier de `lead_imports` (avant d'enquerre en masse)
