-- =====================================================================
-- Feature 007 — Rol Usuario, solicitud de cuenta y registro de
-- modificaciones. Ver specs/007-roles-y-solicitudes/research.md para el
-- rationale completo de cada decisión (referenciado por sección, §N).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. app_users reemplaza a admins (research.md §1)
-- ---------------------------------------------------------------------

create table public.app_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null,
  role         text not null check (role in ('admin', 'usuario')),
  approved_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

insert into public.app_users (user_id, email, display_name, role, approved_by)
select a.user_id, u.email, u.email, 'admin', a.user_id
from public.admins a
join auth.users u on u.id = a.user_id;

drop policy "admins_self_read" on public.admins;
drop table public.admins;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users where user_id = auth.uid() and role in ('admin', 'usuario')
  );
$$;

revoke execute on function public.is_editor() from public;
grant execute on function public.is_editor() to authenticated, anon;

alter table public.app_users enable row level security;

create policy "app_users_read" on public.app_users
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy "app_users_admin_revoke_usuario" on public.app_users
  for delete to authenticated
  using (public.is_admin() and role = 'usuario');

-- ---------------------------------------------------------------------
-- 2. account_requests: solicitud pública sin login (research.md §2)
-- ---------------------------------------------------------------------

create table public.account_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text not null,
  status       text not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada')),
  user_id      uuid references auth.users(id) on delete set null,
  reviewed_by  uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at  timestamptz
);

create unique index account_requests_pending_email_idx
  on public.account_requests (lower(email))
  where status = 'pendiente';

alter table public.account_requests enable row level security;

create policy "account_requests_public_insert" on public.account_requests
  for insert to anon, authenticated
  with check (
    status = 'pendiente' and user_id is null
    and reviewed_by is null and reviewed_at is null
  );

create policy "account_requests_admin_read" on public.account_requests
  for select to authenticated
  using (public.is_admin());

create policy "account_requests_self_read" on public.account_requests
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

create policy "account_requests_admin_review" on public.account_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. claim_approved_account(): enganche del rol en el próximo login real
--    (research.md §3)
-- ---------------------------------------------------------------------

create or replace function public.claim_approved_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.account_requests;
  acct_email text;
begin
  if auth.uid() is null then
    return;
  end if;

  if exists (select 1 from public.app_users where user_id = auth.uid()) then
    return;
  end if;

  acct_email := auth.jwt() ->> 'email';
  if acct_email is null then
    return;
  end if;

  select * into req
  from public.account_requests
  where lower(email) = lower(acct_email)
    and status = 'aprobada'
    and user_id is null
  order by reviewed_at desc nulls last, requested_at desc
  limit 1;

  if not found then
    return;
  end if;

  insert into public.app_users (user_id, email, display_name, role, approved_by)
  values (auth.uid(), acct_email, req.display_name, 'usuario', req.reviewed_by);

  update public.account_requests set user_id = auth.uid() where id = req.id;
end;
$$;

revoke execute on function public.claim_approved_account() from public;
grant execute on function public.claim_approved_account() to authenticated;

-- ---------------------------------------------------------------------
-- 4. milestones/sightings: is_admin() -> is_editor() (research.md §4)
--    La condición de ownership sobre pets.visibility/created_by, ya
--    introducida por 005-tipo-privado-publico, se conserva tal cual.
-- ---------------------------------------------------------------------

drop policy "milestones_admin_write" on public.milestones;

create policy "milestones_editor_write" on public.milestones
  for all to authenticated
  using (public.is_editor() and exists (
    select 1 from public.pets p where p.id = milestones.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ))
  with check (public.is_editor() and exists (
    select 1 from public.pets p where p.id = milestones.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ));

drop policy "sightings_admin_write" on public.sightings;

create policy "sightings_editor_write" on public.sightings
  for all to authenticated
  using (public.is_editor() and exists (
    select 1 from public.pets p where p.id = sightings.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ))
  with check (public.is_editor() and exists (
    select 1 from public.pets p where p.id = sightings.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ));

-- ---------------------------------------------------------------------
-- 5. pets: políticas nuevas para que el rol Usuario cree/edite/elimine
--    sus propias mascotas Privadas (research.md §8). Se suman a las de
--    administradora (pets_admin_insert/update/delete), no las reemplazan.
-- ---------------------------------------------------------------------

create policy "pets_usuario_insert_private" on public.pets
  for insert to authenticated
  with check (
    public.is_editor() and not public.is_admin()
    and visibility = 'privado' and created_by = auth.uid()
  );

create policy "pets_usuario_update_own_private" on public.pets
  for update to authenticated
  using (
    public.is_editor() and not public.is_admin()
    and visibility = 'privado' and created_by = auth.uid()
  )
  with check (
    public.is_editor() and not public.is_admin()
    and visibility = 'privado' and created_by = auth.uid()
  );

create policy "pets_usuario_delete_own_private" on public.pets
  for delete to authenticated
  using (
    public.is_editor() and not public.is_admin()
    and visibility = 'privado' and created_by = auth.uid()
  );

-- ---------------------------------------------------------------------
-- 6. storage.objects (bucket pet-photos): de is_admin() a ownership por
--    ruta (research.md §9). Reemplaza a las tres políticas de
--    petdex-schema.sql — no viven en una migración previa.
-- ---------------------------------------------------------------------

drop policy "pet_photos_admin_write" on storage.objects;
drop policy "pet_photos_admin_update" on storage.objects;
drop policy "pet_photos_admin_delete" on storage.objects;

-- security definer, no una subconsulta cruda: la política de storage.objects
-- necesita mirar una fila de `pets` para decidir ownership, y una subconsulta
-- directa dentro del WITH CHECK quedó demostrada frágil en la práctica (el
-- caso "mascota pública ajena" pasó igual, research.md §9 nota post-
-- implementación). Estas dos funciones resuelven la consulta con los
-- privilegios de la función (bypass de RLS sobre `pets`, igual que
-- is_admin()/is_editor() ya hacen sobre `app_users`), así el resultado no
-- depende de cómo se evalúa RLS entre tablas distintas dentro de una policy.
create or replace function public.pet_row_exists(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pets where id = pid);
$$;

create or replace function public.pet_is_own_private(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pets
    where id = pid and visibility = 'privado' and created_by = auth.uid()
  );
$$;

revoke execute on function public.pet_row_exists(uuid) from public;
grant execute on function public.pet_row_exists(uuid) to authenticated, anon;
revoke execute on function public.pet_is_own_private(uuid) from public;
grant execute on function public.pet_is_own_private(uuid) to authenticated, anon;

create policy "pet_photos_editor_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and (
      public.is_admin()
      or (
        public.is_editor()
        and (
          not public.pet_row_exists(((storage.foldername(name))[1])::uuid)
          or public.pet_is_own_private(((storage.foldername(name))[1])::uuid)
        )
      )
    )
  );

create policy "pet_photos_editor_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and (
      public.is_admin()
      or (
        public.is_editor()
        and public.pet_is_own_private(((storage.foldername(name))[1])::uuid)
      )
    )
  );

create policy "pet_photos_editor_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and (
      public.is_admin()
      or (
        public.is_editor()
        and public.pet_is_own_private(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- ---------------------------------------------------------------------
-- 7. pet_activity_log: registro de solo lectura, llenado solo por
--    triggers security definer (research.md §5)
-- ---------------------------------------------------------------------

create table public.pet_activity_log (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_label text not null,
  action      text not null check (action in (
                'mascota_creada', 'mascota_editada',
                'hito_agregado', 'hito_editado', 'hito_eliminado',
                'avistamiento_marcado'
              )),
  detail      text,
  created_at  timestamptz not null default now()
);

create index pet_activity_log_pet_date_idx on public.pet_activity_log (pet_id, created_at desc);

alter table public.pet_activity_log enable row level security;

create policy "pet_activity_log_admin_read" on public.pet_activity_log
  for select to authenticated
  using (public.is_admin());

create or replace function public.current_actor_label()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select display_name from public.app_users where user_id = auth.uid()),
    'Cuenta sin registrar'
  );
$$;

create or replace function public.log_pet_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pet_activity_log (pet_id, actor_id, actor_label, action)
  values (
    new.id, auth.uid(), public.current_actor_label(),
    case when tg_op = 'INSERT' then 'mascota_creada' else 'mascota_editada' end
  );
  return new;
end;
$$;

create trigger pets_log_activity
  after insert or update on public.pets
  for each row execute function public.log_pet_activity();

create or replace function public.log_milestone_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    begin
      insert into public.pet_activity_log (pet_id, actor_id, actor_label, action, detail)
      values (old.pet_id, auth.uid(), public.current_actor_label(), 'hito_eliminado', old.title);
    exception when foreign_key_violation then
      -- El hito se está borrando en cascada junto con su mascota (misma
      -- sentencia) — ya no queda pet_id al que asociar el evento, y el
      -- historial de esa mascota de todos modos no sobrevive a su borrado
      -- (research.md, mismo trade-off ya documentado). Sin este catch, la
      -- eliminación completa de la mascota fallaba entera con
      -- "pet_activity_log_pet_id_fkey" en vez de completarse — nota
      -- post-implementación, research.md §5.
      null;
    end;
    return old;
  end if;
  insert into public.pet_activity_log (pet_id, actor_id, actor_label, action, detail)
  values (
    new.pet_id, auth.uid(), public.current_actor_label(),
    case when tg_op = 'INSERT' then 'hito_agregado' else 'hito_editado' end,
    new.title
  );
  return new;
end;
$$;

create trigger milestones_log_activity
  after insert or update or delete on public.milestones
  for each row execute function public.log_milestone_activity();

create or replace function public.log_sighting_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pet_activity_log (pet_id, actor_id, actor_label, action, detail)
  values (
    new.pet_id, auth.uid(), public.current_actor_label(), 'avistamiento_marcado',
    to_char(new.seen_on, 'YYYY-MM-DD')
      || ' — ' || case when new.seen then 'visto' else 'revisado y no estaba' end
  );
  return new;
end;
$$;

create trigger sightings_log_activity
  after insert or update on public.sightings
  for each row execute function public.log_sighting_activity();

-- ---------------------------------------------------------------------
-- 8. my_account_status(): un solo RPC para que el cliente resuelva rol y
--    estado de solicitud (contracts/database.md)
-- ---------------------------------------------------------------------

create or replace function public.my_account_status()
returns table(role text, request_status text)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select au.role from public.app_users au where au.user_id = auth.uid()),
    (
      select ar.status
      from public.account_requests ar
      where lower(ar.email) = lower(auth.jwt() ->> 'email')
      order by ar.requested_at desc
      limit 1
    )
$$;

revoke execute on function public.my_account_status() from public;
grant execute on function public.my_account_status() to authenticated, anon;
