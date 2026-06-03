-- ============================================================
-- 038 — Drop Custom Fields module
-- ============================================================
-- Le module Champs perso (custom fields) est retiré : usage très
-- faible et complexité disproportionnée. On supprime les tables
-- `custom_field_definitions` et `custom_field_values` créées par
-- 014_custom_fields.sql.
-- ============================================================

-- Tables (ordre : enfants d'abord)
drop table if exists public.custom_field_values;
drop table if exists public.custom_field_definitions;
