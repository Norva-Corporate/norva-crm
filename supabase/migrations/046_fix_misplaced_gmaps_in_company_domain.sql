-- ============================================================
-- 046 — Cleanup : URL Google Maps mal placées dans companies.domain
-- ============================================================
-- Le scraping Multica a parfois rangé l'URL Google Maps dans la
-- colonne `domain` au lieu de `google_maps_url` (introduit en 045).
-- On déplace ces URLs vers la bonne colonne, et on vide domain qui
-- n'est plus correctement utilisable.
--
-- Cas concret en prod (2026-06-02) : 1 entreprise corrigée
-- (`I.s.a auto piece`). La migration reste utile si la dérive se
-- reproduit côté scraping — opération idempotente, ne touche que
-- les rows où google_maps_url est null.
-- ============================================================

update public.companies
set
  google_maps_url = coalesce(google_maps_url, domain),
  domain = null
where domain is not null
  and domain ~ '^https?://(www\.)?google\.[a-z\.]+/maps/'
  and google_maps_url is null;
