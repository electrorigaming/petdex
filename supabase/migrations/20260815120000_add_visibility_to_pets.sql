-- =====================================================================
-- Campo Tipo (Privado/Público) y visibilidad por cuenta administradora.
-- Ver specs/005-tipo-privado-publico/research.md para el rationale
-- completo de cada decisión.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------

alter table public.pets
  add column visibility text not null default 'publico'
    check (visibility in ('publico', 'privado'));

alter table public.pets
  add column created_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------
-- 2. RLS de pets — lectura pública total pasa a depender de visibility
-- ---------------------------------------------------------------------

drop policy "pets_public_read" on public.pets;
drop policy "pets_admin_write" on public.pets;

create policy "pets_select" on public.pets
  for select
  using (visibility = 'publico' or created_by = auth.uid());

-- Sin chequeo de created_by en el insert a propósito: la app nunca manda
-- visibility/created_by (quedan en su default), y restorePet() reinserta
-- una fila completa que puede traer un created_by que no es el de quien
-- restaura (mascota pública borrada por una admin distinta de su creadora
-- original) — research.md §3.
create policy "pets_admin_insert" on public.pets
  for insert to authenticated
  with check (public.is_admin());

create policy "pets_admin_update" on public.pets
  for update to authenticated
  using (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()))
  with check (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()));

create policy "pets_admin_delete" on public.pets
  for delete to authenticated
  using (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()));

-- ---------------------------------------------------------------------
-- 3. Inmutabilidad de visibility/created_by desde la API
--    USING ve la fila vieja y WITH CHECK la nueva por separado: las
--    policies de arriba, por sí solas, permitirían que una admin no dueña
--    tomara una mascota pública ajena y se autoasignara como dueña al
--    marcarla privada en el mismo update. Un trigger sí puede comparar
--    OLD/NEW de la misma sentencia — research.md §3.1.
-- ---------------------------------------------------------------------

create or replace function public.pets_lock_visibility()
returns trigger
language plpgsql
as $$
begin
  if (new.visibility is distinct from old.visibility
      or new.created_by is distinct from old.created_by)
     and current_user in ('authenticated', 'anon') then
    raise exception 'El campo Tipo solo se puede modificar directamente en la base.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger pets_lock_visibility_trigger
  before update on public.pets
  for each row execute function public.pets_lock_visibility();

-- ---------------------------------------------------------------------
-- 4. Herencia de visibilidad en milestones y sightings
--    Si no podés ver la ficha, tampoco podés ver ni escribir su timeline
--    de hitos ni su calendario de avistamientos (incluido vía
--    rpc('mark_sighting', ...), que corre security invoker) — research.md §4.
-- ---------------------------------------------------------------------

drop policy "milestones_public_read" on public.milestones;
drop policy "sightings_public_read" on public.sightings;

create policy "milestones_select" on public.milestones
  for select using (exists (
    select 1 from public.pets p
    where p.id = milestones.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ));

create policy "sightings_select" on public.sightings
  for select using (exists (
    select 1 from public.pets p
    where p.id = sightings.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ));

drop policy "milestones_admin_write" on public.milestones;
drop policy "sightings_admin_write" on public.sightings;

create policy "milestones_admin_write" on public.milestones
  for all to authenticated
  using (public.is_admin() and exists (
    select 1 from public.pets p where p.id = milestones.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ))
  with check (public.is_admin() and exists (
    select 1 from public.pets p where p.id = milestones.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ));

create policy "sightings_admin_write" on public.sightings
  for all to authenticated
  using (public.is_admin() and exists (
    select 1 from public.pets p where p.id = sightings.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ))
  with check (public.is_admin() and exists (
    select 1 from public.pets p where p.id = sightings.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ));

-- ---------------------------------------------------------------------
-- 5. pets_overview — suma visibility al final (CREATE OR REPLACE VIEW no
--    permite insertar columnas en el medio)
-- ---------------------------------------------------------------------

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
    visibility
   from pets p;

-- Guard explícito: la vista fue creada originalmente con
-- security_invoker = on (para que la política de quien consulta se
-- aplique también a través de la vista) y Postgres debería preservar esa
-- opción a través de CREATE OR REPLACE VIEW, pero la migración anterior
-- (sterilized) no la repite explícitamente. Sin esto, si la opción se
-- hubiera perdido, toda mascota privada se filtraría silenciosamente a la
-- cuadrícula pública — research.md §2. Si ya estaba seteada, es un no-op.
alter view public.pets_overview set (security_invoker = on);
