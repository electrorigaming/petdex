-- Agrega "desconocido" como tercer desenlace manual, con el mismo
-- comportamiento que "adoptado"/"fallecido": si está presente, gana sobre
-- el cálculo automático de pets_overview (migración
-- 20260817120000_derive_status_from_sightings).

alter table public.pets drop constraint if exists pets_status_check;

alter table public.pets
  add constraint pets_status_check
  check (status is null or status in ('adoptado', 'fallecido', 'desconocido'));
