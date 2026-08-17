-- =====================================================================
-- Activo/Desaparecido dejan de ser manuales: se derivan de los
-- avistamientos. pets.status pasa a ser un "desenlace" opcional
-- (adoptado/fallecido) que, si está presente, gana siempre; si es null,
-- pets_overview calcula Activo/Desaparecido según si hubo un avistamiento
-- "visto" en los últimos 3 días corridos.
--
-- Umbral de 3 días: marcar un avistamiento es una acción manual (alguien
-- tiene que pasar y tocarlo). Con un umbral de 1 día, un solo día sin que
-- nadie camine por esa cuadra ya mostraría "Desaparecido" — falsa alarma.
-- Un registro recién creado (menos de 3 días) tampoco tiene ese margen
-- todavía, así que arranca en Activo sin importar si hay avistamientos.
-- =====================================================================

-- today_local(): mismo offset fijo UTC-3 que src/lib/dates.ts
-- (LOCAL_OFFSET_HOURS) — el barrio no observa horario de verano, así que
-- no hace falta un nombre de zona horaria real, alcanza con el offset.
create or replace function public.today_local()
returns date
language sql
stable
as $$
  select ((now() - interval '3 hours')::date)
$$;

-- Primero se abre la columna (nullable, sin el check viejo) y recién
-- después se pisan los valores que ahora se calculan solos — al revés, el
-- UPDATE de abajo pisaría contra el "not null" todavía vigente.
alter table public.pets
  alter column status drop default,
  alter column status drop not null;

alter table public.pets drop constraint if exists pets_status_check;

-- Los valores que ahora se calculan solos no tienen sentido guardados a
-- mano: si quedaran, pets_overview los ignoraría silenciosamente (el
-- desenlace manual siempre gana) y la fila mentiría sobre lo que el
-- formulario puede volver a producir.
update public.pets set status = null where status in ('activo', 'sin_ver');

alter table public.pets
  add constraint pets_status_check
  check (status is null or status in ('adoptado', 'fallecido'));

-- pets_overview — se suma "outcome" (el valor crudo, para que el
-- formulario de edición sepa si hay un desenlace manual cargado) y los
-- campos que antes solo leía getPetBySlug() directo de pets, para que la
-- ficha también pueda consultar la vista y obtener el status calculado.
-- Todo lo nuevo va al final: CREATE OR REPLACE VIEW no permite insertar
-- ni renombrar columnas existentes en el medio (42P16), solo agregar al
-- final — mismo motivo que ya documentó la migración de género.
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
    gender,
    location,
    age_estimate,
    weight_kg,
    description,
    status as outcome
   from pets p;

alter view public.pets_overview set (security_invoker = on);
