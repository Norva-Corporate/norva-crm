-- ============================================================
-- 017 — Lead quality verification + pipeline kanban
-- ============================================================
-- Ajoute les colonnes de vérification automatique (email, linkedin,
-- entreprise active, perf site) et un axe `pipeline_stage` pour
-- afficher les leads en kanban (brut → vérifié → à contacter →
-- contacté → en discussion).
--
-- Coexiste avec `status` (pending/qualified/converted/dismissed/
-- duplicate) qui reste le cycle de vie terminal. Le kanban filtre
-- sur status='pending' uniquement.
-- ============================================================

alter table public.lead_imports
  -- Email deliverability (chaîne MX → Hunter free → Mailboxlayer free)
  add column if not exists email_verified text
    not null
    default 'unverified'
    check (email_verified in ('valid', 'risky', 'invalid', 'unverified')),

  -- LinkedIn présence (Google site:linkedin.com/in match)
  add column if not exists linkedin_verified boolean not null default false,

  -- Entreprise vivante (BODACC : pas de radiation/procédure collective récente)
  -- NULL = inconnu (pas de SIREN, ou check pas encore fait)
  add column if not exists company_active boolean,

  -- Performance site web (Google PageSpeed Insights, 0-100, mobile)
  -- NULL = pas de site OU check pas encore fait
  add column if not exists pagespeed_score smallint
    check (pagespeed_score between 0 and 100),

  -- Score agrégat de qualité (0-100). Calculé par l'agent à l'INSERT.
  -- Sert au badge 🟢/🟡/🔴 et à la suggestion ⭐ "à contacter".
  add column if not exists quality_score smallint
    check (quality_score between 0 and 100),

  -- Stage visuel pour le kanban. Coexiste avec `status`.
  add column if not exists pipeline_stage text
    not null
    default 'brut'
    check (pipeline_stage in ('brut', 'verified', 'to_contact', 'contacted', 'in_discussion')),

  -- Timestamp de la dernière vérif complète (pour détecter les leads
  -- qui ont vieilli et qu'il faut re-vérifier).
  add column if not exists verified_at timestamptz;

-- Index pour le kanban (filtre status='pending' + tri par stage)
create index if not exists lead_imports_pipeline_stage_idx
  on public.lead_imports(pipeline_stage, imported_at desc)
  where status = 'pending';

-- Index pour détecter les leads à re-vérifier (verified_at vieux)
create index if not exists lead_imports_verified_at_idx
  on public.lead_imports(verified_at)
  where verified_at is not null;

-- Index pour la priorisation auto (suggestion "à contacter")
create index if not exists lead_imports_quality_score_idx
  on public.lead_imports(quality_score desc)
  where quality_score is not null and status = 'pending';
