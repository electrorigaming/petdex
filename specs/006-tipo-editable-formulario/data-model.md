# Data Model: Tipo editable desde el formulario

No hay columnas nuevas — `visibility`/`created_by` ya existen desde
`005-tipo-privado-publico`. Esta feature cambia quién puede escribirlas y
por dónde.

## Cambios en Postgres

### RLS de `pets`

| Política | Antes (005) | Ahora (006) |
|---|---|---|
| `pets_admin_insert` | `with check (is_admin())` | `with check (is_admin() and (visibility = 'publico' or created_by = auth.uid()))` |
| `pets_admin_update` | sin cambios | sin cambios (research.md §2 — ya alcanzaba) |
| `pets_lock_visibility_trigger` | bloqueaba todo cambio de `visibility`/`created_by` desde `authenticated`/`anon` | **eliminado** |

`pets_select`, `pets_admin_delete`, y las políticas de `milestones`/
`sightings` no cambian.

## Tipos de aplicación

### `petFieldsSchema` (`src/lib/validation/pet-schema.ts`)

```ts
export const petFieldsSchema = z.object({
  // ...campos existentes
  visibility: z.enum(PET_VISIBILITY_OPTIONS).default("publico"),  // nuevo
})
```

`PET_VISIBILITY_OPTIONS`/`PET_VISIBILITY_LABEL` ya existían (005) para el
filtro del catálogo — se reutilizan tal cual.

### `PetDetail` (`src/lib/pets.ts`)

```ts
export type PetDetail = {
  // ...campos existentes
  visibility: PetVisibility   // nuevo
}
```

`getPetBySlug()` suma `visibility` a su `.select()` sobre `pets`.

### `createPet` / `updatePet` (`src/lib/actions/pets.ts`)

Ambas Actions agregan al payload de `insert`/`update`:

```ts
visibility: values.visibility,
created_by: values.visibility === "privado" ? user.id : null,
```

`user.id` sale de la misma llamada a `getUser()` que ya existía en cada
Action (research.md §4).

### `app/mascotas/[slug]/editar/page.tsx`

`initialValues` suma `visibility: pet.visibility` al armar los valores
iniciales del formulario (mismo patrón que `status`/`sterilized`).

## View-models (sin cambios)

`PetFilters`/`matchesFilters` (`src/lib/pet-filters.ts`), el badge de
`pet-card.tsx`, y el gateo por `useSession().isAdmin` en `pet-grid.tsx` no
se tocan — ya funcionan sobre `PetSummary.visibility`, que no cambia de
forma.

## Relaciones

Sin cambios respecto de `005-tipo-privado-publico`: `visibility`/
`created_by` siguen siendo atributos de `Pet`, no una entidad nueva.
