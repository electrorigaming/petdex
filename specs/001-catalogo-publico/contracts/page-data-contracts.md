# Contratos de datos por pantalla

Esta feature no expone ni consume una API HTTP propia: son Server Components
consultando Supabase directamente con la anon key. El "contrato" acá es la
forma exacta de cada consulta y qué componente la consume, para que la regla
de "cuadrícula = una sola consulta a `pets_overview`" (constitución) sea
verificable en revisión de código sin tener que leer toda la implementación.

## Pantalla A — `app/page.tsx`

**Consulta 1 — listado**:

```ts
const { data } = await supabase
  .from('pets_overview')
  .select('slug, name, nicknames, photo_url, zone')
  .order('registered_on', { ascending: false })
```

**Consulta 2 — contador** (independiente, nunca `data.length` de la consulta 1):

```ts
const { count } = await supabase
  .from('pets_overview')
  .select('*', { count: 'exact', head: true })
```

**Prohibido**: cualquier consulta a `pets` desde esta pantalla, y cualquier
consulta adicional por tarjeta (avistamientos, hitos, etc.).

**Salida hacia el Client Component** (`<PetGrid />`):

```ts
type PetSummary = {
  slug: string
  name: string
  nicknames: string[]
  photoUrl: string | null
  zone: string | null
}

type PetGridProps = {
  pets: PetSummary[]
  total: number // de la Consulta 2, no de pets.length
}
```

El filtro de zona se deriva dentro de `<PetGrid />` con
`[...new Set(pets.map(p => p.zone).filter(Boolean))]` — no llega como prop
aparte ni se vuelve a consultar la base (ver research.md §2).

## Pantalla B — `app/mascotas/[slug]/page.tsx`

**Consulta 1 — mascota**:

```ts
const { data: pet } = await supabase
  .from('pets')
  .select('name, nicknames, zone, location, registered_on, age_estimate, weight_kg, description, photo_url')
  .eq('slug', slug)
  .maybeSingle()

if (!pet) notFound()
```

**Consulta 2 — hitos** (solo si `pet` existe):

```ts
const { data: milestones } = await supabase
  .from('milestones')
  .select('id, title, occurred_on, category, note')
  .eq('pet_id', pet.id)
  .order('occurred_on', { ascending: false })
```

Nota: la Consulta 2 necesita `pet.id`, así que la Consulta 1 debe incluir
`id` además de los campos de arriba (se omitió en el bloque anterior por
brevedad, pero el `select` real incluye `id`).

**Salida hacia los componentes de la ficha**:

```ts
type PetDetail = {
  name: string
  nicknames: string[]
  zone: string | null
  location: string | null
  registeredOn: string
  ageEstimate: string | null
  weightKg: number | null
  description: string | null
  photoUrl: string | null
}

type Milestone = {
  id: string
  title: string
  occurredOn: string
  category: 'salud' | 'alimentacion' | 'comportamiento' | 'otro' | null
  note: string | null
}
```

Cada campo `null` de `PetDetail` se omite en el render — no se mapea a texto
de relleno en ningún punto entre la consulta y el JSX (FR-013).

## `generateStaticParams`

```ts
const { data } = await supabase.from('pets').select('slug')
return data?.map(({ slug }) => ({ slug })) ?? []
```

Combinado con `dynamicParams = true` y `export const revalidate = 0` en el
mismo archivo (ver research.md §4).
