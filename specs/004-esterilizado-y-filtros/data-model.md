# Data Model: Campo Esterilizado y filtros de Estado/Esterilizado

## Cambios en Postgres

### `pets` (columna nueva)

| Campo | Tipo | Notas |
|---|---|---|
| `sterilized` | `boolean not null default false` | Sin tercer estado — booleano estricto (Clarifications, spec.md). El default aplica tanto a filas nuevas como, por ser `not null default`, a las ya existentes en el momento de la migración (research.md §1). |

### `pets_overview` (vista, columna nueva)

Suma `sterilized` a las columnas ya expuestas (`id, slug, name, nicknames,
photo_url, zone, status, registered_on, seen_today, total_sightings,
last_seen_on, milestone_count`) — ver SQL completo en research.md §1. Nota:
`status` ya estaba expuesto por la vista desde antes de esta feature (no fue
necesario agregarlo).

### RLS

Sin cambios — `sterilized` queda cubierto por las policies ya existentes de
`pets` (lectura pública, escritura vía `pets_admin_write`). Ver research.md
§2.

## Tipos de aplicación

### `PetStatus` / `PET_STATUS_OPTIONS` (`src/lib/pets.ts` / `pet-schema.ts`)

Sin cambios de forma — se reutilizan tal cual para el nuevo filtro de
Estado.

### `PetSummary` (`src/lib/pets.ts`)

```ts
export type PetSummary = {
  slug: string
  name: string
  nicknames: string[]
  photoUrl: string | null
  zone: string | null
  status: PetStatus        // nuevo — ya lo exponía la vista, no se consultaba
  sterilized: boolean      // nuevo
  seenToday: boolean
  lastSeenOn: string | null
}
```

`getPetSummaries()` suma `status, sterilized` al `.select()` sobre
`pets_overview` y los mapea igual que el resto de los campos.

### `PetDetail` (`src/lib/pets.ts`)

```ts
export type PetDetail = {
  // ...campos existentes
  sterilized: boolean   // nuevo
}
```

`getPetBySlug()` suma `sterilized` al `.select()` sobre `pets`.

### `petFieldsSchema` (`src/lib/validation/pet-schema.ts`)

```ts
export const petFieldsSchema = z.object({
  // ...campos existentes
  sterilized: z.boolean().default(false),
})
```

Sin tercer estado, sin `.optional()` — siempre presente en el payload que
sale del formulario (mismo criterio que `status`, que también es
obligatorio y no opcional).

### `createPet` / `updatePet` (`src/lib/actions/pets.ts`)

Ambas Server Actions pasan `sterilized: values.sterilized` al
`insert`/`update` correspondiente — mismo tratamiento que `status` (no
`|| null`, porque el schema ya garantiza un booleano, nunca `undefined`).

## View-models nuevos (solo cliente, no persisten)

### `PetFilters`

```ts
type PetFilters = {
  estado: PetStatus[]        // vacío = sin filtrar por estado
  esterilizado: boolean[]    // vacío = sin filtrar; puede contener [true], [false] o [true, false] (== vacío en efecto)
}
```

Vive como estado local de `FilterablePetGrid` (`pet-grid.tsx`), igual que
`zone` hoy. No se persiste entre cargas (research.md §5).

## Relaciones

Sin cambios respecto del modelo ya documentado en `001-catalogo-publico`:
`sterilized` es un atributo más de `Pet`, no una entidad ni relación nueva.
