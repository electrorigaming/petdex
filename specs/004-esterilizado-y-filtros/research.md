# Research: Campo Esterilizado y filtros de Estado/Esterilizado

No quedaron `NEEDS CLARIFICATION` en el Technical Context — las decisiones de
producto ya se resolvieron en la sesión de brainstorming (Clarifications,
spec.md). Este documento cubre las decisiones técnicas de implementación.

## 1. Definición actual de `pets_overview` y la migración

**Decision**: La vista `pets_overview` se reemplaza con `CREATE OR REPLACE
VIEW`, agregando `p.sterilized` a la lista de columnas ya existente, sin
tocar ninguna de las subconsultas actuales. Definición confirmada por el
usuario (`pg_get_viewdef`):

```sql
CREATE OR REPLACE VIEW public.pets_overview AS
SELECT id,
    slug,
    name,
    nicknames,
    photo_url,
    zone,
    status,
    sterilized,
    registered_on,
    (EXISTS ( SELECT 1
           FROM sightings s
          WHERE s.pet_id = p.id AND s.seen_on = CURRENT_DATE AND s.seen)) AS seen_today,
    ( SELECT count(*) AS count
           FROM sightings s
          WHERE s.pet_id = p.id AND s.seen) AS total_sightings,
    ( SELECT max(s.seen_on) AS max
           FROM sightings s
          WHERE s.pet_id = p.id AND s.seen) AS last_seen_on,
    ( SELECT count(*) AS count
           FROM milestones m
          WHERE m.pet_id = p.id) AS milestone_count
   FROM pets p;
```

La migración completa (`supabase/migrations/20260814120000_add_sterilized_to_pets.sql`):

```sql
alter table public.pets
  add column sterilized boolean not null default false;

create or replace view public.pets_overview as
  -- (SQL de arriba)
```

**Rationale**: `CREATE OR REPLACE VIEW` en Postgres permite agregar columnas
al final de la lista de `SELECT` sin recrear la vista (y sin perder
dependencias/permisos), siempre que las columnas existentes no cambien de
nombre, tipo ni posición — condición que se cumple acá. Reescribir la vista
a mano habría arriesgado alterar silenciosamente la lógica de
`seen_today`/`total_sightings`/`last_seen_on`/`milestone_count`; usar la
definición real confirmada por el usuario elimina ese riesgo.

**Alternatives considered**: Agregar `sterilized` con un `ALTER VIEW ...
RENAME`/vista separada — rechazado, Postgres no soporta agregar columnas a
una vista sin `CREATE OR REPLACE` (o un `DROP`+`CREATE`, que sí perdería
grants); no hay razón para pagar ese costo cuando `CREATE OR REPLACE` cubre
el caso.

**Aplicación**: el usuario corre `supabase db push` con su propio login (sin
service role key, Principio I). No forma parte de las tasks automatizables
por el agente.

## 2. RLS: sin política nueva

**Decision**: No se agrega ninguna policy. `sterilized` es una columna más
de `pets`, ya cubierta por `pets_admin_write` (`for all ... with check
(is_admin())`) para escritura y por la policy de lectura pública existente
para `select`.

**Rationale**: Las policies de Postgres RLS operan a nivel de fila, no de
columna — no existe un mecanismo (ni se necesita) para restringir un campo
puntual dentro de una tabla ya gobernada por una policy de fila. Los tests
de integración existentes (`tests/integration/rls-pets-write.test.ts`,
`rls-pets-insert.test.ts`) ya verifican esa policy de forma agnóstica a qué
columnas se escriben — siguen siendo evidencia válida sin modificarlos.

**Alternatives considered**: Ninguna — no hay alternativa razonable a "no
tocar RLS" cuando el cambio es una columna dentro de una tabla ya protegida.

## 3. Chip de filtro multi-select

**Decision**: Nuevo componente `src/components/ui/filter-chip.tsx`: un
`<button type="button" aria-pressed>` con las mismas clases visuales que ya
usa `RadioChip` (borde `divider` → `accent` + texto acento cuando está
activo), en vez de un `<input type="radio">`.

**Rationale**: `RadioChip` (`src/components/ui/radio.tsx`) ya resuelve la
apariencia correcta, pero su semántica es de grupo exclusivo (`input
type="radio"`, un solo chip activo por `name`). Los filtros de esta feature
necesitan que varios chips del mismo grupo estén activos a la vez (FR-006),
así que la primitiva correcta es un botón con estado `aria-pressed`
controlado en React — mismo patrón que ya usa `<ViewToggle>`
(`src/components/view-toggle.tsx`) para sus dos botones mutuamente
excluyentes, adaptado acá a selección múltiple independiente por chip.

**Alternatives considered**: Reutilizar `RadioChip` con `type="checkbox"`
forzado vía prop — rechazado, ensuciaría un componente pensado para
selección única con una rama de comportamiento distinta; un componente
nuevo y chico es más claro que una prop condicional que cambia semántica.

## 4. Combinación de filtros (Estado, Esterilizado, Zona, búsqueda)

**Decision**: Una función pura `matchesFilters(pet, filters)` en
`src/lib/pets.ts` (o co-ubicada con `pet-grid.tsx` si no se reutiliza en
otro lado), evaluada dentro del mismo `useMemo` que ya arma `filtered` en
`FilterablePetGrid`. Semántica:

```
matchesEstado = filters.estado.length === 0 || filters.estado.includes(pet.status)
matchesEsterilizado = filters.esterilizado.length === 0 || filters.esterilizado.includes(pet.sterilized)
matchesZona = zone === ALL_ZONES || pet.zone === zone
matchesBusqueda = !query || haystack.includes(query)
resultado = matchesEstado && matchesEsterilizado && matchesZona && matchesBusqueda
```

**Rationale**: Es exactamente la extensión natural del filtro de Zona ya
implementado (mismo archivo, mismo `useMemo`, mismo criterio de "conjunto
vacío = sin filtrar" que ya usa `zone === ALL_ZONES`). No amerita una
librería de filtrado ni normalizar a un DSL — a esta escala (decenas de
mascotas) un `.filter()` con una función pura es más simple y más fácil de
testear en aislamiento (`tests/unit/pet-filters.test.ts`) que cualquier
alternativa.

**Alternatives considered**: Mover el filtrado al servidor (query
parametrizada a `pets_overview`) — rechazado por lo mismo que ya rechazó el
filtro de Zona en `001-catalogo-publico/research.md` §2: no hay presupuesto
para consultas adicionales cuando los datos ya viajaron completos a la
cuadrícula.

## 5. Estado del panel "Filtros" (abierto/cerrado)

**Decision**: Estado local de React (`useState`) dentro de `PetGrid`/
`FilterablePetGrid`, colapsado por defecto en cada carga — no se persiste en
`localStorage` ni en la URL.

**Rationale**: Es una decisión de bajo riesgo y reversible en un solo tap;
persistirla agregaría un mecanismo de estado nuevo (a diferencia de la
preferencia grid/lista, que sí se persiste porque cambia la experiencia de
forma duradera) sin que el usuario lo haya pedido. Los propios chips activos
tampoco se persisten entre cargas — consistente con que el filtro de Zona
actual tampoco lo hace.

**Alternatives considered**: Persistir en `localStorage` como el toggle de
vista — rechazado por alcance, no se pidió y agrega superficie sin
beneficio claro.
