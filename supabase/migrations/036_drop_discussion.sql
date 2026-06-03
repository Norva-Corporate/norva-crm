-- ============================================================
-- 036 — Drop Discussion module
-- ============================================================
-- Le module Discussion (Slack-interne staff) n'est plus utilisé.
-- On supprime tables, policies, triggers et expositions Realtime
-- créés par 012_discussion.sql et 013_discussion_rls_fix.sql.
--
-- Le bucket Storage `discussion-attachments` doit être supprimé
-- manuellement depuis le dashboard Supabase (faire un dump si
-- des fichiers sont encore présents).
-- ============================================================

-- Drop Realtime exposure (silencieux si déjà détaché)
do $$
begin
  begin
    alter publication supabase_realtime drop table public.discussion_messages;
  exception when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime drop table public.discussion_channels;
  exception when undefined_object then null;
  end;
end$$;

-- Tables (ordre : feuilles d'abord)
drop table if exists public.discussion_reads;
drop table if exists public.discussion_messages;
drop table if exists public.discussion_channels;

-- Remove the `discussion_mention` notification type (encoded as text dans la table
-- notifications, donc rien à modifier côté enum ; les anciennes lignes restent
-- consultables — le front les rendra avec l'icône fallback `Bell`).
