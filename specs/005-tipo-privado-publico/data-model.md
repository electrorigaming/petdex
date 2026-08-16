# Data Model: Campo Tipo (Privado/Público)

## Cambios en Postgres

### `pets` (columnas nuevas)

| Campo | Tipo | Notas |
|---|---|---|
| `visibility` | `text not null default 'publico' check (visibility in ('publico','privado'))` | Mismo estilo que `status` (texto + check, valores en español). El default aplica a filas nuevas y, por ser `not null default`, también a las ya existentes al aplicar la migración (SC-001). No editable desde ningún formulario de la app (FR-003) — solo se cambia por SQL directo. |
| `created_by` | `uuid references auth.users(id) on delete set null` | Solo relevante cuando `visibility = 'privado'`. `on delete set null` — si se revoca una cuenta admin, la fila no se borra, queda sin dueño (Edge Case, spec.md). La app nunca lo escribe; se fija a mano junto con `visibility` (research.md §1). |

### `pets_overview` (vista, columna nueva)

Suma `visibility` al final de las columnas ya expuestas (`id, slug, name,
nicknames, photo_url, zone, status, registered_on, seen_today,
total_sightings, last_seen_on, milestone_count, sterilized`) — SQL completo
en research.md §2. No suma `created_by`: la vista solo necesita decidir *qué*
mostrar (ya resuelto por RLS al consultarla) y distinguir Privado/Público
para el badge y el filtro, no exponer de quién es.

### RLS (`pets`, `milestones`, `sightings`)

Cambia la política de lectura pública de las tres tablas y se separa/extiende
la de escritura de `pets` — SQL completo y rationale en research.md §3–§4.
Resumen de las reglas resultantes:

| Tabla | Operación | Regla |
|---|---|---|
| `pets` | select | `publico` **or** `created_by = auth.uid()` |
| `pets` | insert | `is_admin()` (sin chequeo de ownership — research.md §3) |
| `pets` | update / delete | `is_admin()` **and** (`publico` or `created_by = auth.uid()`) |
| `milestones` / `sightings` | select | igual regla que `pets.select`, evaluada sobre la mascota dueña (`exists (...)`) |
| `milestones` / `sightings` | insert / update / delete | `is_admin()` **and** misma regla de ownership sobre la mascota dueña |

Las políticas de `update` por sí solas **no** alcanzan para impedir que una admin no
dueña cambie el Tipo de una mascota pública ajena a privada y se autoasigne como
dueña (`USING` ve la fila vieja, `WITH CHECK` la nueva — research.md §3.1). Por eso se
suma un trigger `BEFORE UPDATE` en `pets` (`pets_lock_visibility_trigger`) que bloquea
cualquier cambio a `visibility`/`created_by` hecho por los roles `authenticated`/`anon`
(el camino de la API), dejando pasar el camino de edición manual por SQL Editor. Este
trigger es la garantía real de FR-003, no la ausencia de un campo en el formulario.

**Guard adicional de la vista**: la migración fuerza explícitamente
`alter view public.pets_overview set (security_invoker = on);` — sin esto, si la opción
se hubiera perdido en algún `CREATE OR REPLACE VIEW` anterior, la cuadrícula filtraría
mascotas privadas ajenas de forma silenciosa (research.md §2).

## Tipos de aplicación

### `PetVisibility` / `PET_VISIBILITY_LABEL` (nuevo, `src/lib/validation/pet-schema.ts`)

```ts
export const PET_VISIBILITY_OPTIONS = ["publico", "privado"] as const
export type PetVisibility = (typeof PET_VISIBILITY_OPTIONS)[number]

export const PET_VISIBILITY_LABEL: Record<PetVisibility, string> = {
  publico: "Público",
  privado: "Privado",
}
```

Mismo patrón que `PET_STATUS_OPTIONS`/`PET_STATUS_LABEL`. No se agrega a
`petFieldsSchema` ni a `createPetSchema`/`updatePetSchema` — el campo no
viaja en el payload del formulario (FR-003).

### `PetSummary` (`src/lib/pets.ts`)

```ts
export type PetSummary = {
  slug: string
  name: string
  nicknames: string[]
  photoUrl: string | null
  zone: string | null
  status: PetStatus
  sterilized: boolean
  visibility: PetVisibility   // nuevo
  seenToday: boolean
  lastSeenOn: string | null
}
```

`getPetSummaries()` suma `visibility` a su `.select()` sobre `pets_overview`
y lo mapea igual que el resto de los campos. Las filas que no pasan la
política `pets_select` (privadas ajenas) directamente no llegan acá — no hay
filtrado adicional que hacer en el código.

`PetDetail` (usado por `getPetBySlug()`) **no** suma `visibility` — el
indicador visual de esta feature es solo de tarjeta de cuadrícula (FR-013),
no de ficha; y el control de acceso a la ficha ya lo resuelve
`pets_select`/`notFound()` sin necesitar el dato en el cliente.

## View-models nuevos (solo cliente, no persisten)

### `PetFilters` (extendido, `src/lib/pet-filters.ts`)

```ts
export type PetFilters = {
  estado: PetStatus[]
  esterilizado: boolean[]
  tipo: PetVisibility[]      // nuevo — vacío = sin filtrar por tipo
}
```

`matchesFilters()` suma una tercera condición AND (`filters.tipo.length ===
0 || filters.tipo.includes(pet.visibility)`), mismo patrón que
`esterilizado`. `EMPTY_PET_FILTERS`/`countActiveFilters()` se extienden
igual.

El grupo de chips "Tipo" en `FilterablePetGrid` (`pet-grid.tsx`) solo se
renderiza cuando `useSession().isAdmin` es `true` (FR-011) — es la única
diferencia de patrón respecto de Estado/Esterilizado, que se muestran
siempre.

## Relaciones

Sin cambios de forma respecto del modelo ya documentado en
`001-catalogo-publico`: `visibility`/`created_by` son atributos más de
`Pet`, no una entidad ni relación nueva. `created_by` es una referencia
lógica a una cuenta administradora (`auth.users`/`admins`), pero no se
modela como relación consultable desde la app (no hay ningún lugar de la UI
que necesite mostrar o resolver "quién es la dueña").
