# Contracts: Server Actions de escritura

Esta app no expone una API pública — las "contracts" son las Server Actions
que los formularios llaman, y la garantía real detrás de cada una es la
política RLS correspondiente (Principio I), no la validación de la Action en
sí. Cada Action:

1. Valida el payload con el mismo esquema Zod que el formulario (research.md §5).
2. Llama `getUser()` (nunca `getSession()`) solo para poder devolver un
   mensaje de error temprano y legible — no es la garantía de seguridad.
3. Ejecuta la operación con el cliente de servidor (`lib/supabase/server.ts`,
   cookies de la request), que respeta RLS igual que cualquier otro cliente.
4. Si Postgres rechaza, mapea el código de error (`src/lib/errors.ts`,
   data-model.md) — nunca devuelve el mensaje crudo.
5. Si tiene éxito, llama `revalidatePath` sobre las rutas públicas afectadas
   (research.md §5) y devuelve los datos que el cliente necesita para
   actualizar su estado local o redirigir.

## `createPet(input)` — `src/lib/pets.ts`

**Input** (validado con `petSchema` + `id: z.string().uuid()`):
```ts
{ id, name, nicknames, slug, zone?, location?, registeredOn, ageEstimate?,
  weightKg?, description?, status, photoUrl? }
```
`photoUrl` ya es la URL pública final — la subida a Storage ya ocurrió en el
cliente antes de llamar esta Action (research.md §4).

**Output**:
- Éxito: `{ ok: true, slug }` — el cliente redirige a `/mascotas/{slug}`.
- Error: `{ ok: false, message }` — `message` ya es el texto mapeado en
  español; nunca el error de Postgres.

**Efectos secundarios**: `revalidatePath('/')`.

**Garantía real**: `pets_admin_write` (`with check (is_admin())`). Un intento
sin sesión admin falla con `42501` sin importar qué validó la Action.

## `updatePet(id, input)` — `src/lib/pets.ts`

**Input**: mismo `petSchema` que `createPet` pero sin `slug` (de solo lectura
en edición, FR-016) y con `photoUrl: string | null | undefined` de semántica
explícita:
- `undefined` → no tocar la foto existente.
- `string` → reemplazo; la Action actualiza la fila y, recién si esa
  actualización tiene éxito, borra el archivo anterior de Storage.
- `null` → quitar sin reemplazar (FR-013); la Action pone `photo_url = null`
  y, recién si esa actualización tiene éxito, borra el archivo anterior.

**Output**: igual forma que `createPet`.

**Efectos secundarios**: `revalidatePath('/')` y
`revalidatePath('/mascotas/[slug]', 'page')` para el slug de la mascota.

**Garantía real**: `pets_admin_write`, misma política que create (`for all`).

## `createMilestone(petId, input)` / `updateMilestone(id, input)` — `src/lib/milestones.ts`

**Input**: `milestoneSchema` (título, fecha, categoría opcional, nota
opcional) + `petId` (create) o `id` (update).

**Output**:
- Éxito: `{ ok: true, milestone: Milestone }` — el cliente inserta/reemplaza
  este objeto directamente en el estado local de la timeline (research.md §5;
  cumple FR-019/020 sin depender de un refetch).
- Error: `{ ok: false, message }`.

**Efectos secundarios**: `revalidatePath('/mascotas/[slug]', 'page')`.

**Garantía real**: `milestones_admin_write`.

## `deleteMilestone(id)` — `src/lib/milestones.ts`

**Precondición de UI** (no de la Action): el diálogo de confirmación exige
que el usuario reconozca el título del hito antes de habilitar el botón
(FR-021) — esto es UX, no seguridad; la Action no depende de eso.

**Output**: `{ ok: true } | { ok: false, message }`.

**Efectos secundarios**: `revalidatePath('/mascotas/[slug]', 'page')`.

**Garantía real**: `milestones_admin_write`.
