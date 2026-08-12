# Contract: Lectura del calendario mensual

## Consulta

Una sola consulta por mes visible, filtrada por rango — nunca una consulta
por día ni una fila pregenerada para "sin registro" (regla explícita del
pedido):

```ts
// src/lib/sightings.ts
async function getSightingsForMonth(
  supabase: SupabaseClient<Database>,
  petId: string,
  year: number,
  month: number // 1-12
): Promise<Map<string /* YYYY-MM-DD */, boolean /* seen */>>
```

```sql
select seen_on, seen
from sightings
where pet_id = :petId
  and seen_on >= :firstDayOfMonth   -- string YYYY-MM-DD, de src/lib/dates.ts
  and seen_on <= :lastDayOfMonth
```

Política aplicable: `sightings_public_read` (`using (true)`) — de lectura
pública, sin sesión requerida. Cualquier persona que visita la ficha ve el
calendario, coherente con FR-001 a FR-009 (no hay restricción de admin acá).

## Proyección a `CalendarDay[]`

Después de la consulta, en memoria (`src/lib/sightings.ts`), nunca en SQL:

```ts
function projectMonth(
  year: number,
  month: number,
  rows: Map<string, boolean>,
  registeredOn: string,
  today: string,
  todayPendingValue: boolean | null = null // ver nota "Bridge US2 → US5" abajo
): CalendarDay[]
```

Para cada fecha entre el primer y el último día del mes (`daysInMonthRange`,
research.md §2):

1. Si la fecha está fuera de `[registeredOn, today]` → `selectable: false`,
   `value` y `pending` no se muestran como marcables (FR-004/005) pero la
   celda existe visualmente (calendario con huecos, no con días faltantes).
2. Si la fecha es hoy y `todayPendingValue !== null` → `value` es el valor
   pendiente (`"visto"` si `true`, `"revisado_no_estaba"` si `false`),
   `pending: true` (el pendiente tiene prioridad visual sobre cualquier fila
   ya confirmada de ese mismo día — no debería coexistir, porque encolar
   sobrescribe, pero si sync ya guardó y la UI todavía no refrescó, se
   prioriza el optimista).
3. Si no, y `rows.has(fecha)` → `value` es `"visto"` o `"revisado_no_estaba"`
   según el `seen` de la fila, `pending: false`.
4. Si no hay fila ni pendiente → `value: "sin_registro"`.

### Bridge US2 → US5: quién llena `todayPendingValue`

`projectMonth` recibe `todayPendingValue` ya resuelto — nunca importa
`PendingSighting` ni `src/lib/offline/*` (esos módulos no existen todavía
cuando se construye `projectMonth` en User Story 2). La tarea que crea esta
función (`tasks.md` T014) implementa el parámetro completo pero siempre lo
llama con `null` desde `<SightingCalendar>`, porque en esa fase no hay cola
offline. Recién en User Story 5 (`tasks.md` T052), `<SightingCalendar>`
empieza a leer `usePendingSighting(petId)` y a pasar `true`/`false`/`null`
en esa misma llamada — **sin tocar el código de `projectMonth` ni su firma**,
solo lo que el componente le pasa. El mismo patrón aplica al cálculo de
racha (ver abajo): `computeStreak` se construye una sola vez en User Story 2
con el parámetro ya presente; User Story 5 solo cambia qué valor le llega
desde `<MonthSummary>`.

## Consulta para la racha

`computeStreak` (data-model.md) necesita ver hacia atrás desde hoy, más allá
del mes que se esté navegando, hasta `registered_on` — sin ningún tope
adicional. A la escala de esta app (decenas de mascotas, cientos de días de
historial como máximo) traer `[registered_on, hoy]` completo es barato; un
tope arbitrario reportaría rachas truncadas a 0 para historiales más viejos
que el tope, lo que violaría FR-007/009 en silencio. Esta consulta es
independiente de `getSightingsForMonth` — mismo patrón de rango, ventana
distinta — y se dispara una sola vez al cargar la ficha, no en cada
navegación de mes.

## Navegación entre meses

`<SightingCalendar>` es un Client Component: la navegación a "mes anterior"
disparra una nueva `getSightingsForMonth` desde el navegador (cliente de
`src/lib/supabase/client.ts`), no una recarga de página. Esto es deliberado
para el modo offline: esas llamadas pasan por la misma request a
`*/rest/v1/**` que el service worker cachea `NetworkFirst`
(research.md §5) — un mes ya visitado con conexión queda disponible para
volver a verlo sin conexión, sin código de caché propio de la app.

**Límite**: no se permite navegar a un mes íntegramente anterior a
`registered_on` ni a uno posterior al mes de hoy (FR-004/005) — el control de
"mes anterior"/"mes siguiente" se deshabilita en esos bordes.
