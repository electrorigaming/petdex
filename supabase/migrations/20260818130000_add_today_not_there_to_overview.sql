-- Botón de un toque para marcar "visto hoy" desde la cuadrícula (sin entrar
-- a la ficha): necesita saber si hoy ya hay una fila y con qué valor, no
-- solo si seen=true. Se agrega today_not_there (espejo de seen_today para
-- seen=false) y de paso se corrige seen_today, que usaba current_date (UTC)
-- en vez de today_local() — un bug latente que mostraba "Hoy" mal marcado
-- entre las 21:00 y las 00:00 (UTC-3). Con el botón nuevo dependiendo de que
-- "hoy" esté bien calculado, no tiene sentido dejar esa inconsistencia.
--
-- today_not_there va al final (mismo motivo que el resto de las columnas
-- agregadas en migraciones previas): CREATE OR REPLACE VIEW no permite
-- insertar ni renombrar columnas existentes en el medio (42P16).
create or replace view public.pets_overview as
select id,
    slug,
    name,
    nicknames,
    photo_url,
    zone,
    coalesce(
      status,
      case
        when registered_on > public.today_local() - 3 then 'activo'
        when exists (
          select 1
            from sightings s
           where s.pet_id = p.id
             and s.seen_on between public.today_local() - 3 and public.today_local() - 1
             and s.seen
        ) then 'activo'
        else 'sin_ver'
      end
    ) as status,
    registered_on,
    (exists ( select 1
           from sightings s
          where s.pet_id = p.id and s.seen_on = public.today_local() and s.seen)) as seen_today,
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
    gender,
    location,
    age_estimate,
    weight_kg,
    description,
    status as outcome,
    (exists ( select 1
           from sightings s
          where s.pet_id = p.id and s.seen_on = public.today_local() and not s.seen)) as today_not_there
   from pets p;

alter view public.pets_overview set (security_invoker = on);
