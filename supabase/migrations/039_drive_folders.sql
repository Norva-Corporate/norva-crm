-- ============================================================
-- 039 — Google Drive folders sur deals et projects
-- ============================================================
-- Phase C du chantier d'audit : remplace l'ancien module Contrats
-- par une auto-création de dossier Google Drive (avec sous-dossiers
-- Brief / Devis / Contrat) lié à chaque deal et chaque project.
--
-- Le scope OAuth `https://www.googleapis.com/auth/drive.file` est
-- ajouté à l'intégration Google existante (provider='google_calendar').
-- Pas besoin d'une seconde ligne user_integrations — Google accepte
-- plusieurs scopes sur le même refresh_token.
-- ============================================================

alter table public.deals
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_url text;

alter table public.projects
  add column if not exists drive_folder_id text,
  add column if not exists drive_folder_url text;

-- Index pour retrouver rapidement les entités sans dossier (utilisé par
-- la server action `ensureDealDriveFolder` côté idempotence).
create index if not exists deals_drive_folder_idx
  on public.deals(drive_folder_id)
  where drive_folder_id is not null;

create index if not exists projects_drive_folder_idx
  on public.projects(drive_folder_id)
  where drive_folder_id is not null;
