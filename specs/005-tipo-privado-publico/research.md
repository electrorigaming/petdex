# Research: Campo Tipo (Privado/Público)

## 1. Modelo de columnas: `visibility` + `created_by`

**Decision**: Dos columnas nuevas en `pets`:
```sql
visibility text not null default 'publico' check (visibility in ('publico','privado'))
created_by uuid references auth.users(id) on delete set null
```

**Rationale**: Sigue el mismo estilo que `status` (texto + check en español, no un
enum de Postgres) en vez de introducir un tipo de dato nuevo al esquema. `created_by`
referencia `auth.users` (no `admins`) porque `admins` solo tiene `user_id` como PK —
mismo patrón que ya usa `admins.user_id`. `on delete set null` (no `cascade`): si se
revoca una cuenta administradora, sus mascotas no deben desaparecer, solo quedan sin
dueño (ver Edge Case en spec.md — comportamiento aceptado explícitamente).

**Alternatives considered**:
- Booleano `is_private`: rechazado por consistencia — el proyecto ya usa texto+check
  para campos de opciones cerradas (`status`), y "Tipo" tiene semántica de dos
  categorías nombradas, no un flag.
- `created_by` con default `auth.uid()` al insertar vía trigger: rechazado — la app
  nunca setea `visibility`/`created_by` (FR-003), así que no hay insert de la app que
  necesite default automático; cuando una admin privatiza una fila a mano por SQL, fija
  ambos valores en la misma sentencia.

## 2. Migración y `pets_overview`

**Decision**: Un solo archivo de migración, mismo patrón que
`20260814120000_add_sterilized_to_pets.sql`: dos `ALTER TABLE ADD COLUMN` seguidos de
un `CREATE OR REPLACE VIEW public.pets_overview` que agrega `visibility` al final del
`SELECT` (no `created_by` — no hace falta en la cuadrícula, solo para decidir qué filas
llegan, que ya resuelve RLS).

**Rationale**: `CREATE OR REPLACE VIEW` exige que las columnas nuevas vayan al final;
insertarlas en el medio rompe la vista (mismo comentario ya dejado en la migración de
`sterilized`). La vista fue creada originalmente `with (security_invoker = on)`
(`petdex-schema.sql`), y Postgres preserva las opciones de una vista a través de
`CREATE OR REPLACE VIEW` — pero la migración de `sterilized` no lo repite
explícitamente, así que no hay que asumirlo sin verificar. **Antes de aplicar esta
migración**, correr en el SQL Editor de Supabase:
```sql
select reloptions from pg_class where relname = 'pets_overview';
```
Se espera `{security_invoker=on}`. Si da `null`, la vista quedó corriendo con los
privilegios de su dueña (`security_invoker=off` por default) — en ese caso **toda
fila privada se filtraría a la cuadrícula pública**, un fallo silencioso que no se
detecta probando la ficha (que consulta `pets` directo, no la vista). Por eso la
migración de esta feature agrega, de forma idempotente y sin depender de qué haya
pasado antes, una línea explícita:
```sql
alter view public.pets_overview set (security_invoker = on);
```
justo después del `create or replace view`. Es un guard barato: si la opción ya
estaba seteada, es un no-op; si no lo estaba, cierra el agujero antes de que la
feature llegue a producción.

## 3. Diseño de políticas RLS + inmutabilidad de `visibility`/`created_by`

**Decision**: Reemplazar `pets_public_read` (hoy `using (true)`) por una política de
`select` consciente de `visibility`/`created_by`, y partir `pets_admin_write` (hoy un
único `for all`) en `insert` / `update` / `delete` para poder distinguir público de
privado solo en las dos últimas:

```sql
create policy "pets_select" on public.pets
  for select
  using (visibility = 'publico' or created_by = auth.uid());

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
```

`pets_select` no lleva `to authenticated`: debe aplicar también a `anon`, igual que la
política que reemplaza.

**Rationale**:
- `insert` se mantiene abierto a cualquier admin (`is_admin()`, sin chequear
  `created_by`) porque la app nunca manda `visibility`/`created_by` en el insert
  (quedan en su default) y porque `restorePet` reinserta una fila completa —
  potencialmente con un `created_by` que no es el de quien ejecuta el restore (una
  mascota pública borrada por la admin B pero creada originalmente por la admin A). Si
  el insert exigiera `created_by = auth.uid()`, restaurar esa mascota fallaría.
  Las administradoras ya son mutuamente confiables por diseño del proyecto (sin
  jerarquía, Principio I) — no hay ganancia real de seguridad en bloquear esto, y sí
  una regresión funcional concreta.
- `update`/`delete` sí distinguen: una vez que una fila es `privado`, solo su
  `created_by` puede tocarla desde la app (FR-009). Una fila `publico` sigue editable
  por cualquier admin (FR-008), igual que hoy.
- Separar `for all` en tres políticas es necesario porque `insert` no tiene fila
  existente sobre la que evaluar `visibility`/`created_by` (no aplica `using`, solo
  `with check`), mientras que `update`/`delete` sí. Mantenerlo como una sola política
  `for all` obligaría a la misma condición para las tres operaciones.

**Alternatives considered**:
- Exigir `created_by = auth.uid()` también en `insert`: rechazado, rompe
  `restorePet` (ver arriba).
- Mantener `pets_admin_write` como una sola política `for all` con la condición de
  ownership aplicada también a `insert`: mismo problema.

### 3.1 Por qué las políticas de arriba NO alcanzan para FR-003 — falta un trigger

`pets_admin_update` evalúa `USING` sobre la fila *vieja* y `WITH CHECK` sobre la fila
*nueva*, cada una por separado. Para una mascota pública creada por la admin A, la
admin B (no dueña) sí pasa `USING` (`visibility = 'publico'` en la fila vieja). Si B
ejecuta `update pets set visibility = 'privado', created_by = '<uuid de B>' where
id = ...`, la fila *nueva* también pasa `WITH CHECK` (`created_by = auth.uid()` ahora
es cierto para B). La política, tal como está escrita, permite que cualquier admin
convierta una mascota pública ajena en privada y se autoasigne como dueña — exactamente
lo que FR-003 prohíbe ("el sistema MUST NOT exponer ningún control... para cambiar el
Tipo"), aunque acá no haya ningún control de UI: RLS por sí sola no alcanza a expresar
"esta columna no cambia", porque compara filas completas, no columna por columna con
memoria de "quién puede tocar qué campo".

**Decision**: Sumar un trigger `BEFORE UPDATE` en `pets` que bloquea cualquier cambio a
`visibility`/`created_by` hecho por los roles que usa la aplicación (`authenticated`,
`anon`), dejando pasar cualquier otro rol — el que usa el SQL Editor de Supabase para
la edición manual:

```sql
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
```

**Rationale**: Un trigger evalúa `OLD`/`NEW` de la misma fila en la misma sentencia, así
que sí puede expresar "esta columna no cambia" sin importar qué combinación de
`visibility`/`created_by` viejo y nuevo pase las policies. Se compara contra
`current_user` (no contra `is_admin()`) porque el objetivo es distinguir *el camino de
acceso* (API vía PostgREST, que siempre corre como `authenticated`/`anon`) del camino
de edición manual (SQL Editor de Supabase, que corre como el rol dueño de la conexión —
`postgres` u otro, nunca `authenticated`/`anon`), no distinguir quién es admin — eso ya
lo cubren las políticas de arriba. El `errcode = '42501'` reutiliza el mapeo que ya
existe en `src/lib/errors.ts` ("No tenés permiso para hacer esto..."), aunque en la
práctica ninguna Server Action llega a disparar este trigger porque ninguna manda
`visibility`/`created_by` en su payload (FR-003) — es una defensa en profundidad, no un
camino esperado.

**Alternatives considered**:
- Confiar en que ninguna Server Action jamás mande esas columnas: rechazado — es
  exactamente el tipo de garantía "vive en el código, no en la base" que el Principio I
  prohíbe. Sin el trigger, un bug futuro en `updatePet` (o un `PATCH` directo a la API
  REST de Supabase con la anon key de una sesión admin) podría cambiar `visibility`
  silenciosamente, sin que ninguna policy existente lo impida.
- Restringir el `WITH CHECK` de `pets_admin_update` a `visibility = (select visibility
  from pets where id = pets.id)` (comparar contra el valor ya persistido): rechazado —
  más difícil de leer, y un trigger expresa la invariante ("estas dos columnas son
  inmutables desde la app") de forma más directa y reusable si en el futuro se agrega
  otra tabla con el mismo patrón.

**Alcance no cubierto, a propósito**: el trigger solo dispara en `UPDATE`, no en
`INSERT` — `pets_admin_insert` sigue permitiendo que cualquier admin autenticada
inserte una fila con `visibility='privado'`/`created_by` propio directamente vía el
cliente Supabase (sin pasar por el formulario de alta, que nunca manda esos campos, ni
por el SQL Editor). Se deja así deliberadamente porque bloquear `INSERT` de la misma
forma rompería `restorePet` (research.md §3, necesita reinsertar filas privadas
completas). No es una brecha de privacidad entre cuentas — una admin creándose a sí
misma una fila privada propia no expone ni toca datos de nadie más, y el proyecto ya
asume que todas las cuentas administradoras son mutuamente confiables, sin jerarquía
(Principio I). Es, a lo sumo, una forma de saltear la convención operativa de "el Tipo
se fija por SQL Editor" — no un problema de seguridad entre cuentas. Documentado para
que no sorprenda a futuro.

## 4. Herencia de visibilidad en `milestones` y `sightings`

**Decision**: Reemplazar las políticas de lectura pública de ambas tablas por una
condición que consulta `pets` directamente (no delega en la policy de `pets`, evita
cualquier ambigüedad sobre evaluación anidada de RLS):

```sql
create policy "milestones_select" on public.milestones
  for select using (exists (
    select 1 from public.pets p
    where p.id = milestones.pet_id
      and (p.visibility = 'publico' or p.created_by = auth.uid())
  ));
-- misma forma para sightings_select, reemplazando milestones.pet_id por sightings.pet_id
```

Las políticas de escritura (`milestones_admin_write`, `sightings_admin_write`, hoy
`for all to authenticated using (is_admin()) with check (is_admin())`) se extienden
con la misma condición de ownership que `pets_admin_update`/`delete`, para que una
admin que no puede ver una mascota privada tampoco pueda escribirle un hito o marcar
un avistamiento (incluido vía `rpc('mark_sighting', ...)`, que corre `security invoker`
y por lo tanto queda sujeto a esta misma política):

```sql
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
-- misma forma para sightings_admin_write
```

**Rationale**: La spec (Clarifications, sesión 2026-08-15) pide explícitamente que
hitos y avistamientos "hereden la restricción" de la ficha. El texto de la spec habla
en términos de lectura, pero dejar la escritura sin la misma condición abriría un
agujero real: cualquier admin podría marcar un avistamiento o cargar un hito sobre el
`pet_id` de una mascota privada ajena sin poder verla nunca — le alcanzaría con
adivinar o filtrar un UUID. Eso viola el Principio I ("la garantía es la política, no
la oscuridad de un identificador"). Extender la condición de ownership a la escritura
es la lectura consistente de FR-007 y FR-009 aplicada a estas dos tablas, así que se
documenta acá como decisión de diseño en vez de reabrir `/speckit-clarify`.

**Alternatives considered**:
- Dejar `milestones_admin_write`/`sightings_admin_write` sin cambios (solo
  `is_admin()`): rechazado por el agujero de escritura descripto arriba.
- Hacer que la policy de `milestones`/`sightings` delegue en la policy de `pets`
  (por ejemplo con una función `security definer`): rechazado — una subconsulta directa
  contra columnas de `pets` es más simple, más legible en el `pg_policies` del
  dashboard, y no depende de que la policy de `pets` no cambie de nombre/forma en el
  futuro.

## 5. Verificación de RLS sin una segunda cuenta administradora real

**Decision**: Los tests de integración nuevos (`tests/integration/rls-pets-visibility.test.ts`)
no requieren una segunda cuenta de Google autorizada ni dejan filas huérfanas. En vez
de insertar una fila `privado` con un `created_by` ajeno para simular "otra admin", el
test usa **una sola mascota privada, dueña de la propia cuenta de test**, y prueba la
denegación con el cliente `anon` (sin sesión) — el mismo patrón que ya usan
`rls-pets-write.test.ts`/`rls-pets-insert.test.ts`. Para el caso del trigger (§3.1), se
usa una mascota **pública propia** (mismo `created_by` que la cuenta de test): el trigger
no distingue de quién es la fila, bloquea cualquier cambio a `visibility`/`created_by`
hecho por `authenticated`/`anon` sin importar el dueño, así que no hace falta un dueño
ajeno para probarlo — y la fila se mantiene pública y borrable durante todo el test.

**Nota post-implementación**: la primera versión de este test intentó simular "otra
admin" insertando `created_by: crypto.randomUUID()`. Falló en la práctica con `23503`
(`insert or update on table "pets" violates foreign key constraint "pets_created_by_fkey"`)
— `created_by` referencia `auth.users(id)` (§1), así que solo acepta `null` o el UUID de
un usuario real; un UUID inventado nunca pasa la FK, ni siquiera llega a evaluarse contra
RLS. Esto no cambia ninguna conclusión de seguridad de este documento (la garantía sigue
siendo RLS + el trigger), pero corrige la mecánica exacta: `pets_admin_insert` no exige
`created_by = auth.uid()`, pero sí queda acotado a "null o un usuario real que exista",
por la FK — nunca a un valor arbitrario.

**Rationale — por qué "anon deniega" alcanza para probar también "otra admin deniega"**:
`pets_select` es `visibility = 'publico' or created_by = auth.uid()`; `pets_admin_update`/
`delete` agregan `is_admin() and (...)` a la misma condición. Ninguna de las dos
referencia el rol o la identidad de quien consulta más allá de esa comparación de
igualdad. Para cualquier UUID `a` distinto de `created_by` — sea `null` (anon, sin
sesión) o el UUID real de otra cuenta administradora — `created_by = a` evalúa a `false`
o `null`, nunca a `true`. No existe una rama de la política que trate a "otra admin
autenticada" distinto de "anon" en términos de esta comparación: `is_admin()` ya es
`true` para cualquier admin sin importar cuál, así que el único term que decide acceso
es la igualdad de UUIDs, y esa desigualdad se comporta igual seas anon o una segunda
admin real. Probar con `anon` ejercita la misma rama booleana.

**Por qué se descartó simular una segunda admin insertando `created_by` ajeno**: se
intentó primero (ver revisión anterior de este documento), pero el trigger de §3.1
también bloquea cambiar `created_by` desde `authenticated`/`anon` — una vez insertada
una fila `privado` con un `created_by` que no es el de ninguna sesión real disponible,
**ninguna cuenta puede volver a borrarla** (ni `update` para reclamarla, ni `delete`
porque no matchea ownership). Correr `npm run test` repetidamente con ese patrón iría
acumulando filas huérfanas en el proyecto de Supabase real, indefinidamente. El caso del
trigger (§3.1) evita el mismo problema manteniendo la fila **pública** durante todo el
test — el intento de privatizarla falla (es lo que se prueba), así que nunca deja de ser
pública ni de ser borrable.

**Alternatives considered**:
- Provisionar una segunda cuenta administradora de test (`TEST_ADMIN_EMAIL_2`):
  rechazado — agrega una variable de entorno y un paso manual de setup (cargar la fila
  en `admins`) para una cobertura que el argumento de arriba ya da sin necesitarla.
- Insertar la fila `privado` con `created_by` ajeno y aceptar que quede huérfana:
  rechazado — ensuciaría el proyecto de Supabase real en cada corrida de `npm run test`
  (ver rationale arriba).

## 6. Tipos generados y capa de datos

**Decision**: Después de la migración, `npm run gen:types` regenera
`src/types/database.ts` con `visibility`/`created_by` en `pets` y `visibility` en
`pets_overview`. `PetSummary` (`src/lib/pets.ts`) suma `visibility: "publico" |
"privado"`; `getPetSummaries()` agrega `visibility` a su `.select(...)`. No se toca
`getPetBySlug`/`PetDetail` — el indicador visual (FR-013) es solo de tarjeta de
cuadrícula, no de ficha (confirmado en el alcance del diseño previo a esta spec).

**Rationale**: Mínimo cambio necesario para que `pet-grid.tsx`/`pet-filters.ts` puedan
filtrar y mostrar el badge; no se expande el alcance a la ficha porque no está en los
requisitos (FR-013 es explícito sobre "tarjeta de la cuadrícula").
