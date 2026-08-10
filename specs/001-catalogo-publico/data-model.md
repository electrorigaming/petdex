# Data Model: Catálogo público

Todas las entidades ya existen en el esquema aplicado (`petdex-schema.sql`) y
en los tipos generados (`src/types/database.ts`). Esta feature no agrega
columnas, tablas ni vistas — este documento mapea el modelo de datos real a
lo que cada pantalla necesita, y qué queda deliberadamente fuera.

## Mascota (`pets` / `pets_overview`)

| Campo | Tipo | Origen | Uso en esta feature |
|---|---|---|---|
| `slug` | `string` | ambas | Identificador de ruta (`/mascotas/[slug]`). Único, `not null`. |
| `name` | `string` | ambas | Nombre mostrado en cuadrícula, lista y ficha; base de la búsqueda. |
| `nicknames` | `string[]` | ambas | Apodos; se omite si el array está vacío. Parte de la búsqueda. |
| `photo_url` | `string \| null` | ambas | URL pública permanente. `null` → placeholder (Principio IV, FR-019). |
| `zone` | `string \| null` | ambas | Mostrada en tarjeta y ficha; fuente del filtro de zona (ver research.md §2). `null` → se omite. |
| `location` | `string \| null` | solo `pets` | Ubicación de referencia; solo en la ficha. `null` → se omite. |
| `registered_on` | `date (string)` | ambas | Fecha de registro; se muestra en la ficha. |
| `age_estimate` | `string \| null` | solo `pets` | Texto libre ("~2 años", "cachorro"); solo en la ficha. `null` → se omite. |
| `weight_kg` | `number \| null` | solo `pets` | Solo en la ficha. `null` → se omite. |
| `description` | `string \| null` | solo `pets` | Solo en la ficha. `null` → se omite. |
| `status` | `string` | ambas | Existe en el esquema (`activo/sin_ver/adoptado/fallecido`) pero **no está en el alcance de esta feature** — no se filtra ni se muestra distinto por estado; ver Assumptions. |
| `id` | `uuid` | ambas | Solo como clave interna para relacionar hitos; nunca se expone en la URL ni en la UI. |

`milestone_count`, `seen_today`, `total_sightings`, `last_seen_on` existen en
`pets_overview` pero pertenecen al calendario de avistamientos — **fuera de
alcance de esta feature**; no se leen ni se muestran acá.

**Regla de origen de datos**:
- Pantalla A (cuadrícula/lista): una única consulta a `pets_overview`
  (`slug, name, nicknames, photo_url, zone`), más un `count` aparte con
  `head: true` sobre la misma vista para el contador (FR-001). Nunca se
  consultan `pets` ni se hace una subconsulta por tarjeta (constitución,
  sección "Cuadrícula").
- Pantalla B (ficha): una consulta a la tabla base `pets` filtrando por
  `slug` (necesita `location`, `age_estimate`, `weight_kg`, `description`,
  que no están en `pets_overview`).

## Hito (`milestones`)

| Campo | Tipo | Uso en esta feature |
|---|---|---|
| `id` | `uuid` | Clave de lista en React; no se muestra. |
| `pet_id` | `uuid` (FK → `pets.id`) | Filtro de la consulta (`where pet_id = :id`). |
| `title` | `string` | Obligatorio, siempre visible. |
| `occurred_on` | `date (string)` | Obligatorio; determina el orden cronológico (FR-014, FR-015). |
| `category` | `string \| null` | Enum de base: `'salud' \| 'alimentacion' \| 'comportamiento' \| 'otro'` (`CHECK` en `petdex-schema.sql`). `null` → se omite la etiqueta de categoría. |
| `note` | `string \| null` | `null` → se omite. |

**Regla de origen de datos**: una consulta a `milestones` por `pet_id`,
ordenada por `occurred_on desc` (usa el índice `milestones_pet_date_idx` ya
existente). El orden ascendente que pide FR-015 se resuelve invirtiendo el
array ya cargado en el cliente — no se vuelve a consultar la base para
cambiar el orden.

**Cero hitos**: una mascota sin filas en `milestones` es un resultado válido
(array vacío), no un error ni un estado distinto de carga (FR-016).

## Preferencia de vista

No es una entidad de base de datos: es un valor de cliente (`'grid' | 'list'`)
guardado en `localStorage` bajo la clave `petdex:view`. Ver research.md §3
para cómo se aplica sin flash de contenido incorrecto.

## Estados derivados (no persistidos)

| Estado | Condición | Distinto de |
|---|---|---|
| Vacío | El total de `pets_overview` es 0 | "Sin resultados" (FR-009 vs. FR-010) |
| Sin resultados | Hay mascotas, pero la búsqueda/filtro activo no matchea ninguna | Estado vacío |
| Placeholder de foto | `photo_url` es `null` | Imagen rota (nunca debe ocurrir) |
| 404 de mascota | Ninguna fila de `pets` tiene ese `slug` | 404 genérico de Next (nunca se muestra) |

## Fuera de alcance de este modelo

`sightings`, `admins`, y la función `mark_sighting` existen en el esquema
pero pertenecen al calendario de avistamientos y al panel de administración —
features posteriores. Esta feature no los lee ni los escribe.
