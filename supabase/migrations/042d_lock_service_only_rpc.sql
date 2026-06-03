-- ============================================================
-- 042d — Revoke authenticated des RPC réservées service_role
-- ============================================================
-- purge_lead_intake_seen : appelée par cron / migration manuelle uniquement.
-- rls_auto_enable : utilitaire admin, jamais censé être invoqué depuis l'app.
--
-- Note opérationnelle : leaked password protection reste à activer
-- manuellement depuis le dashboard Supabase : Auth → Settings →
-- Password protection → enable. Aucune migration SQL ne peut le flipper
-- (config infra).
-- ============================================================

revoke execute on function public.purge_lead_intake_seen(integer) from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
