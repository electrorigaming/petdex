-- =====================================================================
-- Tipo editable desde el formulario — revierte FR-003 de la migración
-- 20260815120000_add_visibility_to_pets.sql (005-tipo-privado-publico).
-- Ver specs/006-tipo-editable-formulario/research.md para el rationale
-- completo de cada decisión.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Eliminar el trigger que bloqueaba cambiar visibility/created_by
--    desde authenticated/anon — ahora ese es el camino legítimo de la app
--    (research.md §1).
-- ---------------------------------------------------------------------

drop trigger pets_lock_visibility_trigger on public.pets;
drop function public.pets_lock_visibility();

-- ---------------------------------------------------------------------
-- 2. pets_admin_insert se endurece con la misma condición de ownership
--    que ya tenía pets_admin_update desde 005 — research.md §3. No se
--    toca pets_admin_update: ya alcanza sola (research.md §2).
-- ---------------------------------------------------------------------

drop policy "pets_admin_insert" on public.pets;

create policy "pets_admin_insert" on public.pets
  for insert to authenticated
  with check (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()));
