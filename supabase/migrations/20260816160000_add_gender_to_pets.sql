-- =====================================================================
-- Campo Género (Macho/Hembra/Desconocido) en pets.
-- =====================================================================

alter table public.pets
  add column gender text not null default 'desconocido'
    check (gender in ('macho', 'hembra', 'desconocido'));

-- pets_overview — gender al final (CREATE OR REPLACE VIEW no permite
-- insertar columnas en el medio).
create or replace view public.pets_overview as
select id,
    slug,
    name,
    nicknames,
    photo_url,
    zone,
    status,
    registered_on,
    (exists ( select 1
           from sightings s
          where s.pet_id = p.id and s.seen_on = current_date and s.seen)) as seen_today,
    ( select count(*) as count
           from sightings s
          where s.pet_id = p.id and s.seen) as total_sightings,
    ( select max(s.seen_on) as max
           from sightings s
          where s.pet_id = p.id and s.seen) as last_seen_on,
    ( select count(*) as count
           from milestones m
          where m.pet_id = p.id) as milestone_count,
    sterilized,
    visibility,
    gender
   from pets p;

-- Guard idempotente: fuerza security_invoker sin importar si se perdió en
-- algún CREATE OR REPLACE VIEW anterior (mismo criterio que la migración
-- de visibility).
alter view public.pets_overview set (security_invoker = on);
