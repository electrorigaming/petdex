-- =====================================================================
-- PetDex — esquema inicial para Supabase  (v2, corregido)
-- Pegar completo en el SQL Editor del proyecto.
--
-- Cambio respecto de v1: se eliminó el índice GIN con unaccent().
-- unaccent() es STABLE, no IMMUTABLE, y Postgres rechaza expresiones
-- no inmutables en índices (error 42P17). Para el tamaño de este
-- proyecto la búsqueda va del lado del cliente — ver nota al final.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------

create table public.pets (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  nicknames      text[] not null default '{}',
  photo_url      text,
  zone           text,
  location       text,
  registered_on  date not null default current_date,
  age_estimate   text,                      -- texto libre: "~2 años", "cachorro"
  weight_kg      numeric(5,2) check (weight_kg is null or weight_kg > 0),
  description    text,
  status         text not null default 'activo'
                 check (status in ('activo','sin_ver','adoptado','fallecido')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.milestones (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets(id) on delete cascade,
  title        text not null,
  occurred_on  date not null,
  category     text check (category in ('salud','alimentacion','comportamiento','otro')),
  note         text,
  created_at   timestamptz not null default now()
);

create table public.sightings (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  seen_on     date not null,
  seen        boolean not null,             -- true = visto, false = revisado y no estaba
  note        text,
  created_at  timestamptz not null default now(),

  -- Clave del diseño: un registro por mascota por día.
  -- La ausencia de fila significa "sin registro", que es distinto de "no visto".
  unique (pet_id, seen_on)
);

-- Tabla de administradores. Un usuario de auth.users está aquí o no lo está.
create table public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Índices
--    Todas estas expresiones son inmutables. lower() lo es; unaccent() no.
-- ---------------------------------------------------------------------

create index milestones_pet_date_idx on public.milestones (pet_id, occurred_on desc);
create index sightings_pet_date_idx  on public.sightings  (pet_id, seen_on desc);
create index pets_zone_idx           on public.pets       (zone);
create index pets_status_idx         on public.pets       (status);
create index pets_name_lower_idx     on public.pets       (lower(name));

-- ---------------------------------------------------------------------
-- 3. No permitir avistamientos con fecha futura
--    Se hace con trigger y no con CHECK: un CHECK que use current_date
--    no es inmutable y se comporta de forma impredecible en restores.
-- ---------------------------------------------------------------------

create or replace function public.reject_future_sighting()
returns trigger language plpgsql as $$
begin
  if new.seen_on > current_date then
    raise exception 'No se pueden registrar avistamientos futuros (%).', new.seen_on
      using errcode = '22007';
  end if;
  return new;
end;
$$;

create trigger sightings_no_future
  before insert or update on public.sightings
  for each row execute function public.reject_future_sighting();

-- ---------------------------------------------------------------------
-- 4. updated_at automático
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pets_touch_updated_at
  before update on public.pets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. Helper de autorización
-- ---------------------------------------------------------------------

-- security definer + search_path fijo: evita que la función se pueda
-- secuestrar redefiniendo objetos en un esquema de mayor precedencia.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
--    Este es el corazón del modelo de permisos: "lectura pública,
--    escritura solo admin" queda garantizado por la base, no por el código.
-- ---------------------------------------------------------------------

alter table public.pets       enable row level security;
alter table public.milestones enable row level security;
alter table public.sightings  enable row level security;
alter table public.admins     enable row level security;

-- Lectura pública de todo el contenido.
create policy "pets_public_read" on public.pets
  for select using (true);

create policy "milestones_public_read" on public.milestones
  for select using (true);

create policy "sightings_public_read" on public.sightings
  for select using (true);

-- Escritura únicamente para administradores.
-- USING controla qué filas se pueden leer/afectar; WITH CHECK controla
-- qué filas resultantes son válidas. Se necesitan ambos.
create policy "pets_admin_write" on public.pets
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "milestones_admin_write" on public.milestones
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "sightings_admin_write" on public.sightings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- La lista de admins solo es visible para admins. Nunca se escribe desde
-- la app: se administra a mano desde el dashboard.
create policy "admins_self_read" on public.admins
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. Vista para la cuadrícula
--    Evita el N+1 de pedir avistamientos por cada tarjeta.
--    security_invoker: la vista respeta las políticas RLS de quien consulta.
-- ---------------------------------------------------------------------

create view public.pets_overview
with (security_invoker = on)
as
select
  p.id,
  p.slug,
  p.name,
  p.nicknames,
  p.photo_url,
  p.zone,
  p.status,
  p.registered_on,
  exists (
    select 1 from public.sightings s
    where s.pet_id = p.id and s.seen_on = current_date and s.seen
  ) as seen_today,
  (select count(*) from public.sightings s
   where s.pet_id = p.id and s.seen) as total_sightings,
  (select max(s.seen_on) from public.sightings s
   where s.pet_id = p.id and s.seen) as last_seen_on,
  (select count(*) from public.milestones m
   where m.pet_id = p.id) as milestone_count
from public.pets p;

-- ---------------------------------------------------------------------
-- 8. Marcar avistamiento del día (idempotente)
--    Un solo toque desde la ficha. Llamar dos veces no duplica.
-- ---------------------------------------------------------------------

create or replace function public.mark_sighting(
  p_pet_id  uuid,
  p_seen    boolean default true,
  p_date    date default current_date,
  p_note    text default null
)
returns public.sightings
language plpgsql
security invoker          -- deliberado: RLS debe aplicarse a quien llama
set search_path = public
as $$
declare
  result public.sightings;
begin
  insert into public.sightings (pet_id, seen_on, seen, note)
  values (p_pet_id, p_date, p_seen, p_note)
  on conflict (pet_id, seen_on)
  do update set seen = excluded.seen,
                note = coalesce(excluded.note, public.sightings.note)
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Storage: bucket de fotos
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pet-photos',
  'pet-photos',
  true,                                    -- lectura pública, URL permanente
  5242880,                                 -- 5 MB
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do nothing;

create policy "pet_photos_public_read" on storage.objects
  for select using (bucket_id = 'pet-photos');

create policy "pet_photos_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pet-photos' and public.is_admin());

create policy "pet_photos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'pet-photos' and public.is_admin());

create policy "pet_photos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pet-photos' and public.is_admin());


-- =====================================================================
-- NOTA SOBRE LA BÚSQUEDA
--
-- No hay índice full-text a propósito. Con decenas o cientos de mascotas
-- el filtrado va del lado del cliente, sobre los datos que la cuadrícula
-- ya trajo, normalizando acentos en JS:
--
--   const norm = s => s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
--
-- Si algún día la tabla creciera lo suficiente como para justificarlo,
-- la receta es envolver unaccent() en una función IMMUTABLE con el
-- diccionario fijado y usar una columna generada:
--
--   create extension if not exists unaccent with schema extensions;
--
--   create or replace function public.f_unaccent(text)
--   returns text language sql immutable parallel safe strict
--   set search_path = extensions, public
--   as $$ select extensions.unaccent('extensions.unaccent', $1) $$;
--
--   alter table public.pets add column search_vector tsvector
--     generated always as (
--       to_tsvector('spanish',
--         public.f_unaccent(name || ' ' || array_to_string(nicknames,' ')))
--     ) stored;
--
--   create index pets_search_idx on public.pets using gin (search_vector);
--
-- Salvedad: f_unaccent se declara IMMUTABLE sin serlo estrictamente.
-- Es seguro porque el diccionario queda fijado, pero si alguna vez se
-- modifica hay que hacer REINDEX o el índice queda desactualizado sin avisar.
-- =====================================================================


-- =====================================================================
-- Después de correr esto:
--
--   1. Creá el usuario admin en Authentication > Users.
--   2. insert into public.admins (user_id) values ('<uuid-del-usuario>');
--   3. Verificá RLS: con la anon key, un insert en pets debe fallar.
--      Si no falla, algo quedó mal y no sigas construyendo encima.
-- =====================================================================
