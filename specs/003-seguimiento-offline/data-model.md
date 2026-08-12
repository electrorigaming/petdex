# Data Model: Seguimiento diario y funcionamiento offline

## Entidades ya existentes en Postgres (sin cambios)

Documentadas acá como referencia de solo lectura — viven en
`petdex-schema.sql` y `src/types/database.ts`; esta feature no las modifica.

### Sighting (`public.sightings`)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid` | PK |
| `pet_id` | `uuid` | FK → `pets.id`, `on delete cascade` |
| `seen_on` | `date` | Sin hora — se maneja como string `YYYY-MM-DD` en toda la app (research.md §2) |
| `seen` | `boolean` | `true` = visto, `false` = revisado y no estaba |
| `note` | `text` \| `null` | No expuesto en la UI de esta feature (sin campo de nota en el control de marcado) |
| `created_at` | `timestamptz` | |

**Restricción clave**: `unique(pet_id, seen_on)` — un día sin fila es "sin
registro". Esta feature nunca inserta una fila para representar "sin
registro"; el tercer estado es siempre la ausencia de dato, proyectada en
memoria (FR-001 a FR-009).

**Escritura**: exclusivamente vía `rpc("mark_sighting", { p_pet_id, p_seen,
p_date, p_note })` (upsert idempotente sobre la restricción única). Nunca un
`insert`/`update` directo contra la tabla desde esta feature.

### `pets.registered_on`

Ya existente (`date`, `not null default current_date`). Es el límite inferior
del calendario (FR-005): ningún día anterior a este valor se muestra como
marcable ni con datos.

## Entidades nuevas — client-side (no persisten en Supabase)

### PendingSighting (IndexedDB, store `pending_sightings`)

Representa un avistamiento del día de hoy marcado sin conexión, hasta que se
confirma contra el servidor o falla de forma permanente. Vive enteramente en
el dispositivo (research.md §3).

| Campo | Tipo | Notas |
|---|---|---|
| `key` | `string` | `${petId}:${seenOn}` — key path del store. Un solo pendiente posible por (mascota, día). |
| `petId` | `string` (uuid) | |
| `petSlug` | `string` | Denormalizado desde la ficha al momento de encolar — permite que el aviso global de falla permanente (`<SyncFailureBanner>`, ver más abajo) enlace a la mascota correcta sin depender de red para resolverlo. |
| `petName` | `string` | Ídem, solo para mostrar el nombre en el aviso sin una consulta adicional. |
| `seenOn` | `string` (`YYYY-MM-DD`) | Capturado con `todayLocal()` **al marcar**, nunca al sincronizar (FR-021). |
| `seen` | `boolean` | El valor elegido en el momento de marcar. |
| `queuedAt` | `string` (ISO 8601) | Solo para UI ("encolado hace X"); no se envía a `mark_sighting`. |
| `status` | `"pending" \| "syncing" \| "failed"` | Ver transiciones abajo. |
| `failureReason` | `string \| null` | Mensaje ya traducido (`mapPostgresError`), solo si `status === "failed"`. |

**Transiciones de estado**:

```
(no existe) --enqueueSighting()--> pending
pending --intento de sync--> syncing
syncing --éxito--> (se elimina del store; la UI pasa a "confirmado")
syncing --error transitorio (research.md §4)--> pending   [se reintenta en el próximo disparador]
syncing --error permanente (research.md §4)--> failed
failed --enqueueSighting() de nuevo (usuario vuelve a marcar el mismo día)--> pending  [sobrescribe, no acumula]
failed --usuario descarta (FR-024)--> (se elimina del store)
pending --enqueueSighting() con otro valor (mismo día, sin conexión)--> pending  [sobrescribe el valor anterior, FR-022]
```

No hay transición directa `pending → failed` sin pasar por un intento real
de red — un error solo se clasifica cuando efectivamente hubo (o no hubo)
respuesta del servidor.

**Dónde se ve un `failed` (FR-023/024)**: la sincronización corre de forma
global (`<OfflineSyncProvider>` en `app/layout.tsx`, research.md §3), así
que una falla permanente puede ocurrir mientras la administradora está en
cualquier pantalla, no necesariamente en la ficha de la mascota afectada. El
aviso correspondiente es un componente global, `<SyncFailureBanner>`
(montado junto a `<OfflineSyncProvider>`, se suscribe a los eventos
`sighting-sync-failed` de `contracts/offline-queue.md`), no el estado visual
del día en el calendario — ese estado visual solo es visible para quien ya
está mirando esa ficha en particular.

### CalendarDay (view-model, calculado — no se persiste en ningún lado)

Resultado de proyectar en memoria una fila de `sightings` (o su ausencia)
más, opcionalmente, una `PendingSighting` para el día de hoy.

| Campo | Tipo | Notas |
|---|---|---|
| `date` | `string` (`YYYY-MM-DD`) | |
| `value` | `"visto" \| "revisado_no_estaba" \| "sin_registro"` | `"sin_registro"` si no hay fila en `sightings` **ni** entrada pendiente para ese día. |
| `pending` | `boolean` | `true` solo si el día es hoy y hay una `PendingSighting` con `status` `pending` o `syncing` (nunca `failed` — un fallido no cuenta como marcado, ver FR-024). |
| `selectable` | `boolean` | `false` para días futuros o anteriores a `registered_on` (FR-004/005) — controla si el día responde a un toque. |

Se construye recorriendo `daysInMonthRange(year, month)` (research.md §2) y
mapeando cada fecha contra un `Map<string, Sighting>` (una sola consulta por
mes, FR-001/§Calendario del pedido) más, si el mes en curso incluye hoy, la
entrada pendiente de ese pet si existe.

### MonthSummary (view-model, calculado)

| Campo | Tipo | Notas |
|---|---|---|
| `totalSeenThisMonth` | `number` | Cuenta de `CalendarDay` del mes en curso con `value === "visto"`, **incluyendo** los `pending` (Clarifications, spec.md — FR-006). |
| `currentStreak` | `number` | Ver algoritmo abajo. Siempre relativo a hoy, sin importar qué mes esté navegando la persona (Assumptions, spec.md). |

**Algoritmo de racha** (`computeStreak`, `src/lib/sightings.ts`, pura y
testeada — no toca IndexedDB ni Supabase, recibe el mapa de días ya
cargado):

```ts
function computeStreak(
  lookup: Map<string, boolean>, // fecha → seen, de getStreakWindow()
  registeredOn: string,
  today: string,
  todayPendingValue: boolean | null = null // mismo bridge que projectMonth, ver contracts/sightings-read.md
): number
```

```
streak = 0
cursor = today
mientras cursor >= registeredOn:
  día = (cursor == today && todayPendingValue !== null)
          ? (todayPendingValue ? "visto" : "revisado_no_estaba")
          : lookup(cursor)          // "visto" | "revisado_no_estaba" | "sin_registro"
  si día == "revisado_no_estaba": romper           (FR-008 — corta la racha)
  si día == "visto":       streak += 1              (incluye pendiente, FR-006/007)
  si día == "sin_registro": no hacer nada, seguir    (FR-009 — ni corta ni extiende)
  cursor = addDays(cursor, -1)
devolver streak
```

Igual que `projectMonth` (`contracts/sightings-read.md`, "Bridge US2 → US5"):
`computeStreak` se construye una sola vez, con el parámetro
`todayPendingValue` ya presente en su firma; quien cambia es el llamador
(`<MonthSummary>`), que en User Story 2 siempre pasa `null` y en User Story 5
pasa el valor leído de `usePendingSighting`.

Nota: esto requiere que `computeStreak` pueda ver más de un mes hacia atrás
si la racha cruza el límite de mes (por ejemplo, hoy es el día 2 y la racha
viene del mes anterior). La consulta que alimenta el cálculo de racha **no**
está limitada al mes que se está navegando: trae el rango completo
`[registered_on, hoy]` de esa mascota, sin ningún tope adicional — a la
escala de esta app (decenas de mascotas, cientos de días de historial como
máximo, plan.md §Scale/Scope) esa consulta es barata, y cualquier tope
arbitrario (por ejemplo, "últimos 60 días") reportaría una racha de 0 para
una mascota con una racha real más vieja que ese tope, violando FR-007/009
en silencio. Es una consulta separada de `getSightingsForMonth`
(`contracts/sightings-read.md`) — mismo patrón de rango, ventana distinta— y
se dispara una sola vez al cargar la ficha, no en cada navegación de mes. El
calendario visual, en cambio, sí sigue consultando un mes por vez.

### SyncErrorKind (tipo, no entidad)

`"transient" | "permanent"` — resultado de `classifySyncError()`
(research.md §4). No se persiste; se usa en el momento del intento de sync
para decidir la transición de `PendingSighting.status`.

## Relaciones

```
Pet (1) ──── (0..n) Sighting            [ya existente]
Pet (1) ──── (0..1) PendingSighting     [nuevo — a lo sumo un pendiente por mascota, porque solo "hoy" se encola]
Sighting + PendingSighting ──> CalendarDay   [proyección en memoria, 1 por fecha del mes visible]
CalendarDay[] (mes en curso) + CalendarDay[] (ventana de racha) ──> MonthSummary   [cálculo derivado]
```
