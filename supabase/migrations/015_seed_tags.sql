-- ============================================================
-- 015 — Seed tags : pré-remplissage de la table tags
-- ============================================================
-- Pré-remplit la table tags avec une liste réfléchie pour une agence digitale.
-- Couvre 5 axes : priorisation, qualification commerciale, statut/cycle de vie,
-- type de prestation (projets), source d'acquisition.
--
-- Idempotent : on conflict do nothing sur l'index unique tags_name_lower_unique
-- (créé en 007_tags.sql). Ré-applicable sans erreur.
-- created_by laissé NULL (fk on delete set null autorise cette valeur).
--
-- Palette : 9 couleurs cohérentes avec src/components/tags/entity-tags.tsx
--   #EF4444 rouge    → urgence / blocage / risque
--   #F97316 orange   → action requise / attention
--   #F59E0B jaune    → en attente / tiède
--   #22C55E vert     → positif / actif / gagné
--   #3B7BF5 bleu     → neutre / inbound / standard
--   #A855F7 violet   → stratégique / rôle clé
--   #EC4899 rose     → premium / VIP / référence
--   #14B8A6 teal     → récurrent / fidélisation
--   #6366F1 indigo   → froid / dormant / cycle long
-- ============================================================

insert into public.tags (name, color) values
  -- ──────────────────────────────────────────────
  -- Priorisation & urgence (transversaux)
  -- ──────────────────────────────────────────────
  ('🔥 Hot',              '#EF4444'),
  ('Tiède',               '#F59E0B'),
  ('Froid',               '#6366F1'),
  ('Urgent',              '#EF4444'),
  ('À relancer',          '#F97316'),
  ('En attente client',   '#F59E0B'),
  ('Bloqué',              '#EF4444'),

  -- ──────────────────────────────────────────────
  -- Contacts — Qualification commerciale
  -- ──────────────────────────────────────────────
  ('Décideur',            '#A855F7'),
  ('Champion',            '#22C55E'),
  ('Influenceur',         '#6366F1'),
  ('Utilisateur final',   '#14B8A6'),
  ('⭐ VIP',              '#EC4899'),
  ('Sceptique',           '#F59E0B'),
  ('Ne pas contacter',    '#EF4444'),
  ('Newsletter',          '#14B8A6'),

  -- ──────────────────────────────────────────────
  -- Entreprises — Statut & cycle de vie
  -- ──────────────────────────────────────────────
  ('Prospect',            '#6366F1'),
  ('Client actif',        '#22C55E'),
  ('Client inactif',      '#F59E0B'),
  ('Ancien client',       '#F97316'),
  ('Partenaire',          '#A855F7'),
  ('Concurrent',          '#EF4444'),
  ('💎 Key Account',      '#EC4899'),
  ('À renouveler',        '#F59E0B'),
  ('À risque',            '#EF4444'),

  -- ──────────────────────────────────────────────
  -- Deals — Nature & contexte
  -- ──────────────────────────────────────────────
  ('Nouveau client',      '#22C55E'),
  ('Upsell',              '#A855F7'),
  ('Cross-sell',          '#6366F1'),
  ('Renouvellement',      '#14B8A6'),
  ('Référence',           '#EC4899'),
  ('Concurrence',         '#F97316'),
  ('Appel d''offres',     '#6366F1'),

  -- ──────────────────────────────────────────────
  -- Projets — Type de prestation (agence digitale)
  -- ──────────────────────────────────────────────
  ('Site vitrine',        '#3B7BF5'),
  ('E-commerce',          '#14B8A6'),
  ('Refonte',             '#F97316'),
  ('Branding',            '#A855F7'),
  ('SEO',                 '#22C55E'),
  ('SEA / Ads',           '#EC4899'),
  ('Social media',        '#6366F1'),
  ('Maintenance',         '#14B8A6'),
  ('Audit',               '#F59E0B'),
  ('Conseil',             '#A855F7'),

  -- ──────────────────────────────────────────────
  -- Source / canal d'acquisition
  -- ──────────────────────────────────────────────
  ('LinkedIn',            '#3B7BF5'),
  ('Recommandation',      '#22C55E'),
  ('Cold email',          '#F59E0B'),
  ('Cold call',           '#F97316'),
  ('Salon / Event',       '#A855F7'),
  ('Inbound web',         '#3B7BF5'),
  ('SEO organique',       '#14B8A6'),
  ('Réseau perso',        '#EC4899')
on conflict do nothing;
