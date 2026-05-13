-- ============================================================
-- 027 — Brief PDF storage
-- ============================================================
-- Génération PDF côté serveur (Puppeteer + @sparticuz/chromium)
-- → upload dans le bucket Supabase Storage `briefs-pdf` (privé)
-- → chemin stocké dans briefs.pdf_path
--
-- Accès au PDF : uniquement via /api/briefs/[id]/pdf (auth requise),
-- qui télécharge depuis Storage via service_role et le streame au client.
-- Pas de signed URL exposée côté client → moins de surface d'attaque.
-- ============================================================

alter table public.briefs
  add column pdf_path        text,
  add column pdf_generated_at timestamptz;

-- Bucket Storage privé (accès via service_role uniquement).
insert into storage.buckets (id, name, public)
values ('briefs-pdf', 'briefs-pdf', false)
on conflict (id) do nothing;
