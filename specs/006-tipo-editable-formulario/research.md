# Research: Tipo editable desde el formulario

## 1. Eliminar el trigger `pets_lock_visibility_trigger`

**Decision**: `drop trigger pets_lock_visibility_trigger on public.pets;` y
`drop function public.pets_lock_visibility();` — el trigger agregado en
`005-tipo-privado-publico` para bloquear cualquier cambio a
`visibility`/`created_by` desde `authenticated`/`anon` deja de tener sentido:
ahora ese es exactamente el camino legítimo por el que la app tiene que
poder escribir esas columnas.

**Rationale**: El trigger comparaba `OLD`/`NEW` sin importar el contenido —
era una prohibición total, no una regla condicional. No se puede "relajar"
parcialmente sin volver a escribir la lógica de ownership adentro del
trigger, duplicando lo que la policy `pets_admin_update` ya hace en su
`USING`/`WITH CHECK`. Es más simple borrarlo y confiar en la policy, que —
según §2 — ya alcanza sola.

**Alternatives considered**:
- Modificar el trigger para que permita el cambio solo cuando
  `new.created_by = auth.uid()` (o `new.visibility = 'publico'`): rechazado
  — sería repetir exactamente la condición de `pets_admin_update`, en dos
  lugares que podrían divergir con el tiempo. Una sola fuente de verdad
  (la policy) es más simple de auditar.

## 2. `pets_admin_update` ya alcanza — no se toca

**Decision**: No se modifica `pets_admin_update`. Su forma actual (desde
`005-tipo-privado-publico`) ya es:

```sql
create policy "pets_admin_update" on public.pets
  for update to authenticated
  using (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()))
  with check (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()));
```

**Rationale**: `USING` se evalúa contra la fila **vieja** (decide si esta
sesión puede tocar esta fila para empezar — cualquier admin si es pública,
solo la dueña si ya es privada, exactamente FR-003 de esta spec). `WITH
CHECK` se evalúa contra la fila **nueva** (decide si el resultado es válido).
Cuando una admin B guarda con `visibility='privado'`, `WITH CHECK` exige
`created_by = auth.uid()` — es decir, la única forma de que ese guardado
pase es que `created_by` en el payload sea el propio `auth.uid()` de B. Si
B intentara mandar `created_by` de otra cuenta, `WITH CHECK` lo rechaza
(FR-006). Esto es exactamente FR-004 (la dueña pasa a ser quien guarda) y
FR-006 (nadie puede asignarse una dueña que no es la propia) sin escribir
ninguna condición nueva — la policy de `005` ya lo resolvía, el trigger era
lo único que lo bloqueaba.

## 3. `pets_admin_insert` se endurece con la misma condición de ownership

**Decision**:

```sql
drop policy "pets_admin_insert" on public.pets;
create policy "pets_admin_insert" on public.pets
  for insert to authenticated
  with check (public.is_admin() and (visibility = 'publico' or created_by = auth.uid()));
```

**Rationale**: En `005-tipo-privado-publico` esta policy se dejó abierta
(`with check (is_admin())`, sin chequear `created_by`) porque la app nunca
mandaba esas columnas en el insert — el Tipo era de solo lectura, así que la
única función de la policy era "cualquier admin puede insertar mascotas".
Ahora que `createPet` manda `visibility`/`created_by` explícitos (§4), vale
la pena cerrar el mismo hueco que ya se había cerrado en `update`: sin este
endurecimiento, nada impediría que una admin creara directamente (sin pasar
por el formulario) una mascota `privado` con `created_by` de otra cuenta.

**Por qué no rompe `restorePet`** (la razón original para dejarlo abierto):
`restorePet` reinserta una fila completa tal cual estaba al momento del
borrado.
- Si la snapshot es **pública**, `visibility = 'publico'` alcanza para pasar
  el `WITH CHECK` sin importar de quién sea `created_by` — sigue
  funcionando igual que antes para el caso "admin B borra una pública creada
  por A y la restaura".
- Si la snapshot es **privada**, solo pudo haberla borrado su propia dueña
  (`pets_admin_delete` ya exige `created_by = auth.uid()` para una fila
  privada) — así que quien tiene la snapshot para restaurar es, por
  construcción, la misma cuenta que aparece como `created_by` en esa
  snapshot. `WITH CHECK` pasa trivialmente.

**Alternatives considered**:
- Dejar `pets_admin_insert` sin cambios: rechazado — ya no hay ninguna razón
  para mantener ese hueco ahora que sí existe un camino de la app
  (`createPet`) que manda `visibility`/`created_by`.

## 4. Server Actions: `createPet`/`updatePet` mandan `visibility`/`created_by`

**Decision**: Ambas Actions (`src/lib/actions/pets.ts`) agregan al payload:

```ts
visibility: values.visibility,
created_by: values.visibility === "privado" ? user.id : null,
```

`user.id` ya está disponible en ambas Actions desde `getUser()` (usado hoy
solo para el mensaje de error temprano). No se lee ningún valor "anterior"
de `created_by` — se recalcula en cada guardado exclusivamente a partir de
lo que el formulario mandó, sin ninguna rama especial para "ya era privada
antes" (FR-004: siempre la cuenta que guarda, sin importar el historial).

**Rationale**: Coherente con que la única regla de negocio es "privado ==
dueña de quien guardó por última vez" — no hace falta leer el estado previo
de la fila para decidir el nuevo `created_by`, así que no hace falta un
`select` adicional en `updatePet` más allá del que ya existe (para
`slug`/`photo_url`).

**Nota sobre `restorePet` y el `created_by` histórico de 005**: nulear
`created_by` en cada guardado público significa que, a partir de esta
feature, una mascota que vuelve a ser pública pierde el rastro de quién la
había marcado privada antes. El escenario que justificaba dejar
`pets_admin_insert` sin `created_by = auth.uid()` en `005-tipo-privado-publico`
§3 — "una pública creada originalmente por A, borrada y restaurada por B" —
sigue siendo válido para filas que ya existían antes de este cambio (con un
`created_by` histórico que no es de quien restaura), pero deja de producirse
para filas nuevas guardadas después de 006 (que siempre entran a `publico`
con `created_by = null`). No cambia ninguna conclusión de seguridad: el caso
`created_by = null` + `visibility = 'publico'` sigue pasando `pets_admin_insert`
trivialmente (`visibility = 'publico'` alcanza), así que `restorePet` sigue
funcionando igual para cualquier admin, sea cual sea el `created_by` de la
snapshot.

## 5. `petFieldsSchema` suma `visibility`

**Decision**:

```ts
visibility: z.enum(PET_VISIBILITY_OPTIONS).default("publico"),
```

Reutiliza `PET_VISIBILITY_OPTIONS`/`PET_VISIBILITY_LABEL`, ya definidos en
`005-tipo-privado-publico` (`src/lib/validation/pet-schema.ts`) para el
filtro del catálogo — no se duplican.

**Rationale**: Mismo tratamiento que `sterilized`/`status`: campo
obligatorio del formulario con default, no opcional.

## 6. `PetDetail`/`getPetBySlug` suman `visibility` (necesario para editar)

**Decision**: `PetDetail` (`src/lib/pets.ts`) suma `visibility:
PetVisibility`; `getPetBySlug()` selecciona `visibility` de `pets`. La
página de edición (`app/mascotas/[slug]/editar/page.tsx`) lo pasa como
`initialValues.visibility` al armar el formulario.

**Rationale**: El formulario de edición necesita saber el Tipo actual de la
ficha para preseleccionar el radio correcto — sin esto, el campo siempre
arrancaría en "Público" al editar, aunque la ficha ya fuera privada. Esto
amplía el alcance que `005-tipo-privado-publico` había dejado
deliberadamente afuera ("no se toca `PetDetail`") porque en esa spec el
campo no era editable y no hacía falta mostrarlo en el formulario. Sigue
sin mostrarse en `pet-detail.tsx` (la ficha pública) — eso no cambia
(spec.md, Assumptions).

## 7. Verificación sin una segunda cuenta administradora real

**Decision**: Igual criterio que `005-tipo-privado-publico` §5, pero con una
corrección importante encontrada en revisión antes de implementar: un UUID
**inventado** para `created_by` no sirve para probar el rechazo de
`WITH CHECK`, porque nunca llega a evaluarse — `created_by` tiene FK a
`auth.users(id)` (005 §1) y Postgres rechaza el `update`/`insert` con
`23503` (violación de FK) antes de que RLS entre en juego. Esto es
exactamente lo que ya se descubrió en `005-tipo-privado-publico` §5 (nota
post-implementación) al intentar simular "otra admin" con
`crypto.randomUUID()`; una primera versión de esta sección repetía el mismo
error.

La forma correcta de probar FR-006 con una sola cuenta es con
`created_by: null` en vez de un UUID inventado — `null` **sí** es un valor
válido para la FK (la columna es nullable), así que la sentencia llega
hasta RLS, y ahí `WITH CHECK` evalúa `created_by = auth.uid()` como `null =
'<uuid>'`, que en SQL es `null` (no `true`) — la fila se rechaza igual.
Verificado empíricamente: a diferencia de `USING` (que oculta filas en
silencio — 0 filas afectadas, sin error, cuando la fila ni siquiera es
visible/tocable para la sesión), una fila que **sí** pasa `USING` pero cuya
versión nueva falla `WITH CHECK` produce un error explícito de Postgres
(`42501`, "new row violates row-level security policy"), no una selección
vacía — porque acá la fila era legítimamente editable por esta sesión, lo
que se rechaza es el *resultado* del update. Casos que se prueban
empíricamente con una sola cuenta:
- Insertar pública con `created_by` propio, actualizar a privada mandando
  `created_by` propio → éxito, y la fila queda visible solo para esa cuenta
  (camino feliz, FR-004).
- La misma fila, intentar volver a marcarla `visibility='privado'` mandando
  `created_by: null` → error `42501` (`WITH CHECK` falla, `null = auth.uid()`
  nunca es `true`), `data` queda `null` — prueba directamente FR-006:
  ninguna combinación deja una fila en `privado` sin que su `created_by` sea
  exactamente `auth.uid()` de quien ejecuta la sentencia.
- Actualizar de vuelta a `publico` → éxito, vuelve a ser visible para
  `anon` (FR-005).

El caso "B se apropia literalmente de la pública creada por A" (con A y B
siendo cuentas reales distintas) sigue sin poder probarse empíricamente sin
una segunda cuenta de Google — pero queda cubierto por el mismo argumento
lógico que `null` ya prueba: la policy nunca mira **quién** es el dueño
anterior, solo compara el `created_by` de la fila nueva contra `auth.uid()`
de quien ejecuta. Esa comparación se comporta idéntico sea el `created_by`
anterior `null`, el de A, o cualquier otro UUID que no sea el de quien
ejecuta — todos son "no coincide", con el mismo resultado de rechazo.

**Rationale**: El punto crítico de FR-006 no es "quién es A o B", es que la
policy rechaza cualquier fila nueva en `privado` cuyo `created_by` no sea el
propio `auth.uid()` — `null` prueba exactamente esa rama sin necesitar una
segunda cuenta real ni tropezar con la FK.
