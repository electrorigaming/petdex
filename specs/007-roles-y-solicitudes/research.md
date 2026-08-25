# Research: Rol Usuario, solicitud de cuenta y registro de modificaciones

## 1. `app_users` reemplaza a `admins`

**Decision**: Nueva tabla:

```sql
create table public.app_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null,
  role         text not null check (role in ('admin','usuario')),
  approved_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
```

La migración copia cada fila de `admins` con `role='admin'`, usando el email de
`auth.users` como `display_name` inicial (editable a mano si hace falta, no
desde la app — fuera de alcance), y luego elimina `admins` y su policy:

```sql
insert into public.app_users (user_id, email, display_name, role, approved_by)
select a.user_id, u.email, u.email, 'admin', a.user_id
from public.admins a
join auth.users u on u.id = a.user_id;

drop policy "admins_self_read" on public.admins;
drop table public.admins;
```

`is_admin()` se redefine con el mismo nombre y firma (`create or replace
function`, sin tocar `revoke`/`grant` — Postgres conserva los privilegios de
una función al reemplazarla) para leer `app_users` en vez de `admins`:

```sql
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_users where user_id = auth.uid() and role = 'admin'
  );
$$;
```

Se agrega `is_editor()`, mismo patrón, para admin **o** usuario:

```sql
create or replace function public.is_editor()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_users where user_id = auth.uid() and role in ('admin','usuario')
  );
$$;

revoke execute on function public.is_editor() from public;
grant execute on function public.is_editor() to authenticated, anon;
```

**Rationale**: Ninguna política existente que llama a `is_admin()` (`pets_*`,
y hasta que se editen en §4, `milestones_admin_write`/`sightings_admin_write`)
necesita reescribirse — el nombre y el contrato booleano no cambian, solo la
fuente de datos. Es el mismo patrón que ya usa el proyecto (`is_admin()` como
única fuente de verdad para RLS y para el RPC que consulta el cliente).

**RLS de `app_users`**: nada de `insert`/`update` para `authenticated`/`anon`
— la única forma de aparecer en esta tabla es el alta manual por SQL (primera
administradora, igual que hoy) o `claim_approved_account()` (§3, corre
`security definer`, ignora RLS). `select` es propio o de cualquier admin;
`delete` queda acotado a admin revocando una cuenta `usuario` (FR-019),
nunca otra `admin` — evita que el panel de revocar se use por error o abuso
entre administradoras:

```sql
alter table public.app_users enable row level security;

create policy "app_users_read" on public.app_users
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy "app_users_admin_revoke_usuario" on public.app_users
  for delete to authenticated
  using (public.is_admin() and role = 'usuario');
```

**Alternatives considered**:
- Mantener `admins` y agregar una tabla separada para `usuario`: descartado en
  la conversación de diseño — duplica la fuente de verdad de permisos y no
  da un lugar único para el nombre que necesita el historial (§5).
- Permitir que admin revoque a otra admin desde este mismo panel: fuera del
  alcance de la spec (FR-019 habla de "una cuenta que ya tiene rol Usuario");
  se deja fuera para no abrir una superficie de conflicto entre
  administradoras sin que se haya pedido.

## 2. `account_requests`: solicitud pública sin login

**Decision**:

```sql
create table public.account_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  display_name text not null,
  status       text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
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
```

**Rationale**:
- El `check` de formato de email es una defensa mínima en la base, no
  reemplaza la validación de `zod` en el formulario — mismo criterio que ya
  usa el proyecto para otras columnas (`weight_kg > 0`, `status in (...)`).
- El índice único parcial evita que la misma persona (o un script) sature la
  cola con la misma dirección repetida mientras sigue pendiente; no bloquea
  volver a solicitar después de un rechazo, porque el índice solo aplica a
  `status = 'pendiente'`.
- `account_requests_self_read` usa `auth.jwt() ->> 'email'`, no una columna
  `user_id` (que en el momento de solicitar todavía no existe) — es el mismo
  claim que ya expone el JWT de sesión de Supabase para cualquier cuenta
  autenticada, sin necesitar una consulta adicional a `auth.users`.
- `account_requests_admin_review` solo permite `update`, nunca `delete` — no
  hace falta borrar solicitudes resueltas para el alcance de esta feature, y
  conservarlas simplifica auditar quién aprobó/rechazó qué.

**Alternatives considered**:
- Exigir que la persona ya haya iniciado sesión con Google antes de solicitar
  (descartado explícitamente en la conversación de diseño — el usuario pidió
  el formulario sin login "sí o sí").
- Guardar la solicitud directamente en `app_users` con un estado "pendiente"
  en vez de una tabla separada: descartado — `app_users.user_id` es la clave
  primaria y referencia `auth.users`; una solicitud sin login todavía no
  tiene un `auth.users` al que apuntar, así que no puede vivir en esa tabla
  sin volver `user_id` nullable y romper su rol de PK.

## 3. `claim_approved_account()`: dónde se resuelve el enganche

**Decision**:

```sql
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
```

Se llama una vez, desde `app/auth/callback/route.ts`, inmediatamente después
de `exchangeCodeForSession(code)` y antes del redirect:

```ts
const { error } = await supabase.auth.exchangeCodeForSession(code)
if (!error) {
  await supabase.rpc("claim_approved_account")
  return NextResponse.redirect(`${origin}${destination}`)
}
```

**Rationale**:
- Tiene que ser `security definer`: la fila que crea en `app_users` no la
  podría insertar el propio usuario autenticado bajo su rol normal (§1, no
  hay policy de `insert` para `authenticated`) — a propósito, para que nadie
  pueda auto-asignarse un rol escribiendo directo a la tabla. La función es
  la única puerta, y solo actúa sobre solicitudes que una administradora ya
  aprobó explícitamente (`status = 'aprobada'`), nunca sobre pendientes.
- Se llama desde el route handler del callback de OAuth, no desde el cliente
  (por ejemplo, desde `session-provider.tsx`), porque ese es el único punto
  del código que corre exactamente una vez por login exitoso, con la sesión
  ya establecida en el mismo request — evita carreras de "¿ya se llamó esta
  sesión o no?" que aparecerían si se disparara desde un efecto de React en
  cada carga de la app.
- Es idempotente y segura de llamar en cada login: el primer `if exists (...)
  return` hace que, una vez que la cuenta ya tiene una fila en `app_users`
  (por reclamo previo, o por ser administradora dada de alta a mano), la
  función no vuelva a hacer nada.
- No requiere ninguna variable de entorno nueva ni la service role key: corre
  con las credenciales de la sesión recién creada, igual que cualquier otro
  RPC del proyecto.

**Alternatives considered**:
- Un trigger `after insert on auth.users`: descartado — modificar el esquema
  `auth` de Supabase es más frágil entre versiones del proyecto gestionado y
  no está documentado como soportado de la misma forma que `public`; además
  no resolvería el caso de alguien que ya tenía una cuenta de Google
  existente en `auth.users` antes de solicitar (no dispararía `INSERT`).
- Resolver el enganche de forma perezosa, sin RPC dedicado, dentro de
  `session-provider.tsx` en el cliente: descartado — requeriría exponer la
  misma lógica de `insert` a un contexto sin `security definer` (el cliente
  browser corre como `authenticated` normal), lo cual reabre exactamente el
  problema de auto-asignación que la función evita.

## 4. `milestones`/`sightings`: `is_admin()` → `is_editor()`

> **Corrección post-clarificación**: este documento decía originalmente "una
> cuenta `usuario` nunca es dueña de una mascota privada porque nunca crea
> mascotas" — eso ya no es cierto (ver spec.md, Clarifications, sesión de
> revisión: el rol Usuario sí crea mascotas, siempre Privadas). El rationale
> de abajo sigue siendo válido igual, pero por un motivo distinto: no importa
> **quién** sea `created_by` (una administradora o una cuenta Usuario) — la
> condición de ownership `visibility = 'publico' or created_by = auth.uid()`
> nunca mira el rol de quien la evalúa, así que se comporta igual para ambos
> casos sin necesitar ningún cambio adicional. Ver §8 para las políticas
> nuevas de `pets` que sí son específicas del rol Usuario.

**Decision**: Las políticas de escritura existentes (`milestones_admin_write`,
`sightings_admin_write`, con la condición de ownership sobre `pets.visibility`
que ya introdujo `005-tipo-privado-publico`) cambian únicamente su chequeo de
rol, conservando la condición de ownership tal cual:

```sql
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
-- misma forma para sightings_admin_write → sightings_editor_write
```

`pets_admin_insert`/`update`/`delete` **no cambian**: siguen usando
`is_admin()` exclusivamente (FR-004/FR-005 de la spec).

**Rationale**: La condición de ownership ya existente (`visibility =
'publico' or created_by = auth.uid()`) no distingue roles — solo compara
`created_by` contra `auth.uid()`. Eso da, sin ningún cambio adicional a esta
condición puntual, exactamente el comportamiento correcto para el rol
Usuario: puede escribir hitos/avistamientos de cualquier mascota pública
(comparten ese alcance todas las cuentas editoras, sin jerarquía), y solo de
una mascota privada cuando es su propia creadora — nunca de una privada
ajena, sea de otra cuenta Usuario o de una administradora. Es la misma regla
que ya gobernaba esto entre dos administradoras (`005-tipo-privado-publico`),
extendida sin cambios al agregar una segunda categoría de cuenta que también
puede ser `created_by`.

**Alternatives considered**:
- Escribir una condición separada para `usuario` que ignore `visibility` por
  completo: rechazado, sin pedido explícito y con el riesgo de que una cuenta
  Usuario pudiera escribir sobre una mascota privada ajena sin poder verla —
  mismo tipo de agujero que `005-tipo-privado-publico` §4 ya evitó.

## 5. `pet_activity_log`: solo triggers escriben, admin es el único lector

**Decision**:

```sql
create table public.pet_activity_log (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_label text not null,
  action      text not null check (action in (
                'mascota_creada','mascota_editada',
                'hito_agregado','hito_editado','hito_eliminado',
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
```

Sin ninguna policy de `insert`/`update`/`delete` para `authenticated`/`anon`
— la ausencia de policy deniega por default (mismo principio que ya aplica en
el resto del esquema). La única escritura posible es a través de funciones de
trigger `security definer`:

```sql
create or replace function public.current_actor_label()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select display_name from public.app_users where user_id = auth.uid()),
    'Cuenta sin registrar'
  );
$$;

create or replace function public.log_pet_activity()
returns trigger language plpgsql security definer set search_path = public
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
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.pet_activity_log (pet_id, actor_id, actor_label, action, detail)
    values (old.pet_id, auth.uid(), public.current_actor_label(), 'hito_eliminado', old.title);
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
returns trigger language plpgsql security definer set search_path = public
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
```

**Rationale**:
- `security definer` en las funciones de trigger es lo que permite insertar
  en una tabla sin ninguna policy de escritura para `authenticated` — el
  trigger corre con los privilegios de quien definió la función (el rol
  dueño de la migración), no con los del rol que disparó el `INSERT`/`UPDATE`
  original, pero `auth.uid()`/`auth.jwt()` siguen resolviendo a la sesión que
  originó la operación porque leen del JWT de la conexión, no del rol de
  ejecución. Es la misma técnica que ya usan `is_admin()`/`is_editor()`, solo
  que acá lo que se protege es la tabla completa (ni una admin puede escribir
  el historial a mano desde la app — FR-012).
- `sightings`: `mark_sighting()` hace upsert (`on conflict do update`); el
  trigger `after insert or update` cubre ambas ramas del upsert sin
  duplicar lógica — Postgres dispara el evento correcto según qué rama tomó
  el `INSERT ... ON CONFLICT`.
- No hay un evento `mascota_eliminada`: como `pet_activity_log.pet_id` tiene
  `on delete cascade`, cualquier fila que se insertara para ese evento
  desaparecería en la misma sentencia junto con el resto del historial de esa
  mascota — no hay forma de que sobreviva para mostrarse en ninguna parte, así
  que agregarla sería trabajo sin efecto observable.
- `current_actor_label()` devuelve un texto fijo ("Cuenta sin registrar") si
  quien escribe no tiene fila en `app_users` — no debería pasar en la
  práctica (solo admin/usuario pueden llegar a disparar estos triggers, y
  ambos están en `app_users` por definición), pero evita que un `NULL` rompa
  el `not null` de `actor_label` ante cualquier caso borde no previsto.

**Nota post-implementación — bug real: borrar una mascota con hitos fallaba
entero**: la primera versión de `log_milestone_activity()` insertaba
`hito_eliminado` sin manejo de error alguno. Al borrar una mascota que
todavía tenía hitos, `on delete cascade` dispara el `DELETE` en cascada sobre
`milestones`, que a su vez dispara `milestones_log_activity` — pero para ese
momento la fila de `pets` ya no existe (la misma sentencia la está
borrando), así que el `insert` a `pet_activity_log` viola
`pet_activity_log_pet_id_fkey` y **toda la operación de borrado de la
mascota fallaba** (no solo el logueo — la transacción entera se revierte).
Encontrado recién en verificación manual, limpiando datos de prueba: 18 de
36 mascotas de prueba no pudieron borrarse por este motivo en corridas
anteriores de la suite (los tests que solo hacían `await admin.from("pets").delete(...)`
sin chequear `error` "pasaban" igual, dejando basura huérfana sin que nadie
lo notara). Se corrigió envolviendo ese `insert` en un `begin/exception when
foreign_key_violation then null; end;` — si la mascota se está borrando en
la misma sentencia, no hay `pet_id` al que asociar el evento, y el
historial de esa mascota de todos modos no sobrevive a su borrado (ya
documentado como trade-off aceptado más arriba), así que ignorar el error
es exactamente el comportamiento correcto, no un parche cosmético.

**Alternatives considered**:
- Registrar el historial desde las Server Actions (`src/lib/actions/*.ts`) en
  vez de triggers: rechazado explícitamente en la conversación de diseño — una
  Server Action que se olvide de loguear (o un `PATCH` directo a la API REST
  de Supabase con la sesión de una cuenta editora) dejaría el historial
  incompleto sin que la base lo impida, violando el mismo principio que ya
  gobierna el resto del proyecto (Principio I: la garantía vive en Postgres).
- Guardar diffs de campo por campo en vez de un evento con texto libre:
  descartado en la conversación de diseño (decisión ya cerrada, ver
  Clarifications de `spec.md`).

## 6. Verificación sin depender de un login real de Google

**Decision**: Los tests de integración nuevos siguen el patrón ya establecido
por `tests/integration/rls-milestones-write.test.ts` (`signInWithPassword`
contra una cuenta de prueba dedicada, habilitada solo para testing — nunca es
el flujo real de la app, que sigue siendo Google-only). Se agrega un segundo
par de credenciales de prueba, `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`, para
una cuenta pre-cargada en `app_users` con `role = 'usuario'`.

Para `claim_approved_account()`, en vez de automatizar un login real de
Google (no es viable en un test de integración ni en Playwright sin
credenciales reales de una cuenta de Google), el test:
1. Inicia sesión con la cuenta de prueba `TEST_USER_EMAIL` (password auth,
   igual que las demás).
2. Inserta directamente (como esa misma sesión, vía `anon`/`authenticated`,
   no como admin) una fila en `account_requests` con ese mismo email y la deja
   pendiente, luego la aprueba con la sesión admin de prueba.
3. Llama a `rpc('claim_approved_account')` con la sesión de `TEST_USER_EMAIL`
   ya autenticada, y verifica que aparece la fila esperada en `app_users`.

Esto prueba la función exactamente como la ejercería el callback real
(mismo `auth.uid()`, mismo `auth.jwt()->>'email'`), sin necesitar que el test
pase por el proveedor OAuth de Google.

**Rationale**: El objetivo del test es la lógica de la función y las
políticas RLS que la rodean, no el proveedor de autenticación en sí — eso ya
lo cubre Supabase Auth y está fuera del control de esta feature. Evitar
depender de Google en CI es coherente con cómo ya se prueba todo lo demás en
este proyecto (los tests de RLS existentes tampoco pasan por Google).

**Nota**: la misma cuenta `TEST_USER_EMAIL` sirve para los tests de §8/§9
(crear/editar/eliminar su propia mascota Privada, e intentar — y fallar —
tocar una mascota Pública o la Privada de la cuenta admin de prueba, y subir
foto solo bajo su propio `petId`). No hace falta una tercera cuenta de
prueba: alcanza con la cuenta admin ya existente (`TEST_ADMIN_EMAIL`) para
representar "la cuenta ajena" en esos casos.

**Nota post-implementación — rate-limit real de Supabase Auth**: con todos
los tests de integración de esta feature sumados a los ya existentes,
`npm run test` empezó a fallar de forma intermitente con
`over_request_rate_limit` (429) — Supabase Auth limita los sign-in
repetidos de una misma cuenta en poco tiempo, y la corriendo completa (20
archivos, varios con su propio ciclo admin/usuario) lo alcanza a gatillar.
Se corrigió con tres cambios, ninguno de la app: (1) cada `describe` que
necesita más de una cuenta autenticada la firma **una sola vez** en
`beforeAll`/reutiliza esa sesión entre sus `it()` (`afterAll` cierra
sesión), en vez de un sign-in nuevo por test; (2) `tests/integration/helpers/auth.ts`
agrega un reintento corto con backoff (`signInWithRetry`) para el caso en
que igual se dispare el límite; (3) `vitest.config.ts` corre los archivos
de test en serie (`fileParallelism: false`) — con paralelismo, varios
archivos abren sus propias sesiones al mismo tiempo y el ahorro de (1) no
alcanza. También se subió `testTimeout` a 20000ms: varios tests de
integración ya tardaban 3000-4900ms contra el proyecto real incluso antes
de esta feature, muy cerca del default de Vitest (5000ms).

**Alternatives considered**:
- Un test e2e con Playwright que intente automatizar el login real de Google:
  rechazado — frágil, requeriría credenciales reales de una cuenta de Google
  guardadas en CI, y Google activamente dificulta la automatización de su
  pantalla de login. El flujo de UI alrededor del enganche (mensaje "tu
  solicitud está pendiente", panel de aprobación) sí se cubre con Playwright
  usando las cuentas de prueba por contraseña ya soportadas por el proyecto
  (`tests/e2e/auth.setup.ts`), sin tocar el proveedor Google real.

## 7. Tipos generados

**Decision**: Después de aplicar la migración, `npm run gen:types` regenera
`src/types/database.ts` con las tres tablas nuevas (`app_users`,
`account_requests`, `pet_activity_log`) y sin `admins`. Cualquier código que
todavía tipara contra `Database["public"]["Tables"]["admins"]` (ninguno,
verificado por búsqueda) quedaría marcado por `npm run typecheck`.

**Rationale**: Mismo flujo ya establecido por el Principio V — no se escriben
tipos a mano para las tablas nuevas.

**Nota**: `pets.visibility` ya está en `PetDetail`/`getPetBySlug()`
(`src/lib/pets.ts`) desde `006-tipo-editable-formulario` — el formulario de
edición ya necesitaba mostrar el Tipo actual para poder cambiarlo. Esta
feature reutiliza ese mismo campo para decidir, en el cliente, si mostrar los
controles de editar/eliminar a una cuenta Usuario (§8) — no hace falta
agregar ninguna columna nueva a la consulta.

## 8. `pets`: políticas nuevas para que el rol Usuario cree/edite/elimine sus propias Privadas

**Decision**: Se agregan tres políticas nuevas, además de las tres ya
existentes de administradora (`pets_admin_insert`/`update`/`delete`, sin
tocar). Al ser políticas permisivas adicionales sobre la misma tabla y
operación, Postgres las combina con OR — no reemplazan a las de admin, se
suman:

```sql
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
```

**Rationale**:
- `not is_admin()` es defensivo/aclaratorio, no estrictamente necesario (una
  admin ya tiene sus propias políticas más amplias) — deja explícito que
  esta política es "el carril del rol Usuario", legible en `pg_policies` sin
  tener que razonar sobre la interacción entre ambos conjuntos.
- **Por qué no hace falta un trigger para bloquear el cambio de Tipo** (a
  diferencia del que existió en `005-tipo-privado-publico` §3.1 para
  administradoras): acá, tanto `USING` como `WITH CHECK` exigen
  `visibility = 'privado'` sobre la fila vieja **y** la nueva. Un intento de
  `update pets set visibility = 'publico' where id = ...` sí pasa `USING`
  (la fila vieja es `privado`, propia), así que Postgres la toma como
  candidata a modificar — pero la fila **nueva** (`visibility = 'publico'`)
  no satisface `WITH CHECK`. A diferencia de `USING` (que solo filtra qué
  filas son candidatas, sin generar error si ninguna cuenta como tal),
  **una fila candidata que no pasa `WITH CHECK` sí produce un error explícito
  (`42501`)** — no un resultado silencioso vacío. La política sigue
  rechazando el cambio por sí sola, sin necesitar lógica adicional que
  compare `OLD`/`NEW` explícitamente; solo hay que esperar el error en vez
  de una lista vacía (nota post-implementación: la primera versión de este
  documento y de `tests/integration/rls-pets-write.test.ts` asumía
  incorrectamente el resultado silencioso — corregido). Distinto del caso de
  `005-tipo-privado-publico` §3.1, donde el problema era que una admin *sí*
  podía pasar `WITH CHECK` cambiando ambos campos a la vez (autoasignándose
  como dueña) — acá eso no aplica: `created_by = auth.uid()` en `WITH CHECK`
  ya impide que una cuenta Usuario reasigne `created_by` a cualquier valor
  que no sea el suyo propio.
- **Por qué la administradora sigue sin poder ver ni tocar una Privada de un
  Usuario** (confirmado explícitamente con el usuario, spec.md
  Clarifications): `pets_select` no distingue roles (`visibility = 'publico'
  or created_by = auth.uid()`), así que una mascota Privada de un Usuario es
  invisible también para cualquier administradora — no hay ninguna política
  de `select` que dependa de `is_admin()`. `pets_admin_update`/`delete`
  exigen `is_admin() and (visibility = 'publico' or created_by =
  auth.uid())`; para una Privada ajena (de un Usuario), ninguna rama de ese
  `and` se cumple, así que tampoco alcanzan a evaluarla. No hace falta ningún
  cambio en las políticas de admin para producir este aislamiento — ya es lo
  que hacen tal como están.

**Alternatives considered**:
- Dar a las administradoras una vía de supervisión sobre las Privadas de
  Usuario (una cuarta política tipo `pets_admin_oversight`): descartado
  explícitamente por el usuario — mismo aislamiento que ya existe entre dos
  administradoras, sin excepción por rol.
- Un trigger `BEFORE UPDATE` explícito para bloquear el cambio de Tipo (calcado
  de `005-tipo-privado-publico` §3.1): descartado, redundante — el `WITH
  CHECK` de la política ya lo bloquea sin trigger (ver rationale arriba).

## 9. `storage.objects` (bucket `pet-photos`): de `is_admin()` a ownership por ruta

**Decision**: Reemplazar las tres políticas de escritura de `petdex-schema.sql`
(`pet_photos_admin_write`/`update`/`delete`, no viven en una migración
previa — hay que `drop policy` explícito antes de crear las nuevas) por
versiones que admiten a cualquier administradora (sin cambios de
comportamiento) **o** a una cuenta Usuario únicamente sobre la carpeta de una
mascota que no exista todavía (flujo de creación) o que ya sea su propia
Privada:

```sql
drop policy "pet_photos_admin_write" on storage.objects;
drop policy "pet_photos_admin_update" on storage.objects;
drop policy "pet_photos_admin_delete" on storage.objects;

create or replace function public.pet_row_exists(pid uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.pets where id = pid); $$;

create or replace function public.pet_is_own_private(pid uuid)
returns boolean language sql stable security definer set search_path = public
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
      or (public.is_editor() and public.pet_is_own_private(((storage.foldername(name))[1])::uuid))
    )
  );

create policy "pet_photos_editor_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and (
      public.is_admin()
      or (public.is_editor() and public.pet_is_own_private(((storage.foldername(name))[1])::uuid))
    )
  );
```

> **Nota post-implementación — bug real encontrado y corregido**: la primera
> versión de esta sección usaba `exists (select 1 from public.pets p where
> ...)` directo dentro del `WITH CHECK`/`USING`, en vez de las dos funciones
> de arriba. Verificado en producción: ese `exists` crudo, evaluado dentro de
> una policy de `storage.objects` (tabla distinta a `pets`), **no** reflejaba
> con confiabilidad lo que la misma cuenta ve al consultar `pets` directo por
> PostgREST — concretamente, subir una foto bajo el `petId` de una mascota
> **pública ajena** tuvo éxito para una cuenta Usuario cuando debía fallar
> (confirmado con un script de diagnóstico contra el proyecto real: `usuario
> .from("pets").select(...)` sí devolvía la fila, pero el mismo `exists()`
> evaluado dentro de la policy de storage se comportaba como si la fila no
> existiera). No se identificó la causa exacta de la discrepancia entre
> ambos contextos de evaluación de RLS — encapsular la consulta en una
> función `security definer` (mismo patrón que `is_admin()`/`is_editor()`,
> que ya evitan este mismo tipo de ambigüedad para `app_users`) la eliminó
> de raíz, sin depender de entender por qué el `exists` crudo fallaba. Regla
> general que queda de acá para el resto del proyecto: una policy de una
> tabla que necesita mirar una fila de **otra** tabla con RLS propia debería
> hacerlo a través de una función `security definer`, no con una subconsulta
> directa en la expresión de la policy.

**Por qué hace falta tocar storage y no alcanza con las políticas de `pets`**:
sin esto, extender la escritura de storage de `is_admin()` a `is_editor()` sin
más (el cambio "obvio" e insuficiente) dejaría que cualquier cuenta Usuario
subiera, reemplazara o borrara el archivo de **cualquier** ruta
`<petId>/...` del bucket, con solo conocer o adivinar el UUID de una mascota
ajena — incluida una Pública que no puede editar desde `pets`, o la Privada
de otra cuenta. El bucket es público de lectura y las URLs son predecibles
(`<petId>/<timestamp>.webp`), así que esto sería un agujero real de
desfiguración/borrado cruzado entre cuentas, no solo un problema teórico.

**Por qué el `insert` necesita la rama "no existe fila todavía"**:
`PhotoField` (`src/components/pets/photo-field.tsx`) sube la foto **antes**
de que exista la fila en `pets` — `petId` se genera en el cliente
(`crypto.randomUUID()`) y se usa como prefijo de ruta desde el primer
`onSubmit` del formulario de alta, no después de que `createPet()` inserte la
fila. En ese momento, ninguna política que dependiera de `exists (select 1
from pets where id = ...)` con condición de ownership podría pasar, porque
todavía no hay fila que matchear — bloquearía la subida de foto para
**cualquier** mascota nueva, incluidas las de administradoras si se aplicara
parejo. La rama "no existe fila con ese id" cubre exactamente esta ventana,
sin abrir nada: un UUID recién generado por `crypto.randomUUID()` no puede
colisionar con el de una mascota real existente (aleatoriedad de 122 bits), así
que "la fila todavía no existe" es, en la práctica, sinónimo de "es una
mascota nueva propia siendo creada ahora mismo" — no una forma de escribir
sobre el hueco de un id ajeno ya usado.

**`storage.foldername(name)` y el casteo a `uuid`**: `storage.foldername()`
devuelve un arreglo de texto con los segmentos de carpeta de la ruta (`{name}`
sin el archivo final), 1-indexado — para `<petId>/123.webp` da `{petId}`, así
que `(storage.foldername(name))[1]` es el segmento que interesa. Se castea
ese segmento a `uuid` (comparando `p.id = (...)::uuid`) en vez de castear
`p.id` a `text`: si algún día `pets.id` deja de ser `uuid`, el error aparece
acá y no como un `false` silencioso; y si una ruta llega con un primer
segmento que no es un UUID válido (nadie debería poder construir una así
desde la app, que siempre usa `crypto.randomUUID()`), el casteo lanza una
excepción de Postgres en vez de devolver `false` — la operación igual queda
rechazada (la transacción aborta), solo que con un error distinto a `42501`.
Se documenta acá como el comportamiento esperado, no un caso a corregir.
**Verificar antes de aplicar la migración**, en el SQL Editor:
```sql
select storage.foldername('abc/123.webp');
-- esperado: {abc}
```

**Alternatives considered**:
- Extender `is_admin()` a `is_editor()` sin condición de ruta: rechazado —
  abre el agujero de desfiguración/borrado cruzado descripto arriba.
- Verificar ownership contra la fila de `pets` en todos los casos (sin la
  rama "no existe todavía"): rechazado, rompe la subida de foto en el flujo
  de creación de cualquier mascota nueva (research.md, este mismo punto).

## 10. `updatePet()`/`deletePet()`: detectar 0 filas afectadas

**Decision**: `src/lib/actions/pets.ts` — `updatePet()` agrega `.select().maybeSingle()`
al final de su `update(...)` y trata `data === null` (sin `error`) como una
falla de permiso (`{ ok: false, message: "No tenés permiso para editar esta
mascota." }`, o el mensaje ya mapeado si corresponde). `deletePet()` pasa a
usar `.delete({ count: "exact" })` y trata `count === 0` de la misma forma.

**Por qué esto no es cosmético**: Supabase/PostgREST no reporta error cuando
un `update`/`delete` con `RLS` activo no matchea ninguna fila (a diferencia
de un `insert`, que sí falla con `42501`) — simplemente afecta cero filas.
Hasta ahora esto era inofensivo en la práctica: cualquier cuenta que llegaba
a la página de edición de una mascota (`getPetBySlug` ya filtrado por RLS)
siempre tenía también permiso de escritura sobre ella, porque el único rol
que editaba (administradora) tiene lectura y escritura acopladas sobre lo
mismo (público total, o su propia privada). El rol Usuario rompe ese
acoplamiento por primera vez: puede **leer** cualquier mascota Pública (para
navegarla, ver sus hitos) pero **no escribirla**. Si esa cuenta llega
—típicamente escribiendo la URL a mano, ya que el botón no se muestra— a
`/mascotas/{slug-pública}/editar` y guarda, o si se dispara `deletePet` sobre
un id que no le pertenece, hoy la Action devolvería `{ ok: true, ... }` sin
haber cambiado nada: un falso éxito. Para `deletePet()` es peor que
cosmético — devuelve un `snapshot` de una fila que **no se borró**, y si la
persona usa "Deshacer" sobre ese snapshot, `restorePet()` intenta reinsertar
un `id` que ya existe, y falla por violación de clave primaria con un error
confuso, no relacionado con el problema real (falta de permiso).

**Alternatives considered**:
- Agregar un chequeo de rol/ownership explícito en la propia Server Action
  antes de llamar a Postgres: rechazado — es exactamente el tipo de
  duplicación de la garantía de RLS en código de aplicación que el Principio
  I evita; además tendría que reimplementar la misma condición de ownership
  que ya vive en la política, con riesgo de que diverjan.
- Dejar el comportamiento como está y resolverlo solo ocultando el botón en
  la UI: rechazado — no cubre el acceso directo por URL/Server Action, que
  es justamente el caso que ahora se vuelve alcanzable con una cuenta real
  (no hace falta manipular la red a mano, alcanza con escribir la URL de
  edición de cualquier mascota pública estando logueado como Usuario).
