# Quickstart: Seguimiento diario y funcionamiento offline

Guía de validación manual y automatizada de esta feature. No repite código de
implementación — ver `data-model.md` y `contracts/` para eso.

## Prerrequisitos

- `.env.local` con las dos variables ya existentes (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — sin variables nuevas.
- Esquema ya aplicado (`petdex-schema.sql`), sin migraciones pendientes.
- Al menos una mascota cargada, con `registered_on` de hace más de una semana
  (para poder navegar meses anteriores y ver una racha con algo de historial).
- Una sesión de administradora disponible para probar el marcado (misma
  cuenta autorizada en `admins` que usa la feature 2).
- `npm install` (agrega `@serwist/next`, `serwist`, `idb`, `fake-indexeddb`).

**Nota sobre el service worker en desarrollo**: Serwist genera `public/sw.js`
en cada build; `npm run dev` lo registra igual, pero para probar caché e
instalación PWA de forma realista conviene `npm run build && npm run start`
(el modo dev de Next.js invalida chunks constantemente, lo que confunde la
verificación de "shell precacheado").

## Validación 1 — Calendario y marcado, con conexión

```bash
npm run dev
```

1. Abrir la ficha de una mascota con historial. Verificar:
   - El mes en curso muestra los tres estados con formas distintas (no solo
     color) — probar con el modo escala de grises del sistema operativo o
     una captura convertida a blanco y negro (SC-002).
   - El total del mes y la racha junto al calendario coinciden con un conteo
     manual de los días marcados.
2. Iniciar sesión como administradora. Tocar "Visto" en el control de hoy.
   Verificar: el día de hoy pasa a "visto" con una sola acción, el total del
   mes sube en 1 si no estaba ya contado.
3. Tocar "Revisado y no estaba" sobre el mismo día. Verificar: no aparece un
   segundo registro — el mismo día cambia de estado.
4. Desde el calendario, tocar un día pasado sin registro y marcarlo.
   Verificar: aparece con el estado elegido; intentar tocar un día futuro no
   ofrece ninguna acción.

## Validación 2 — Racha

Con una mascota que tenga: 3 días "visto" consecutivos, luego un día
"revisado y no estaba", luego un día "sin registro", luego 2 días "visto"
más (el más reciente = hoy):

- La racha mostrada debe ser **2** (los dos últimos "visto"), no 6 — el día
  "revisado y no estaba" la corta y el "sin registro" ni la extiende ni la
  corta, pero tampoco se salta hacia atrás del corte.

## Validación 3 — Offline: consultar contenido ya visitado

```bash
npm run build && npm run start
```

1. Con conexión, abrir la cuadrícula y navegar **con un click** (no
   recargando la página) a al menos dos fichas de mascotas distintas — para
   que el service worker cachee tanto la carga completa como el payload RSC
   de la navegación client-side (research.md §5, "Navegación client-side y
   RSC"; probar solo con recarga completa no detecta si esa segunda regla
   falta).
2. DevTools → Network → Offline (o desconectar la red real).
3. Recargar la app. Verificar: la cuadrícula y las fichas visitadas siguen
   visibles, con sus fotos, y un aviso indica que el contenido puede estar
   desactualizado y desde cuándo (FR-017/018).
4. Intentar abrir la ficha de una mascota **no** visitada antes de
   desconectar. Verificar: el sistema lo indica con claridad, sin pantalla en
   blanco ni error crudo de red (User Story 4, edge case correspondiente).

## Validación 4 — Offline: marcar hoy y sincronizar

1. Con conexión y sesión admin, abrir la ficha de una mascota. Desconectar
   la red (DevTools → Network → Offline, más realista que apagar el wifi
   porque no corta el propio devtools).
2. Tocar "Visto". Verificar: el día se muestra con estado "pendiente"
   (distinto visualmente de un confirmado), y el total/racha del mes ya lo
   cuentan.
3. Reconectar la red. Verificar, sin recargar la página: el estado pasa solo
   a "confirmado" en pocos segundos (los disparadores son `online` y
   `visibilitychange`, `contracts/offline-queue.md`).
4. Confirmar contra la base (o recargando y mirando el calendario) que la
   fecha guardada es la del momento en que se marcó (paso 2), no la de la
   reconexión (paso 3).
5. Repetir el paso 2 dos veces seguidas sin conexión, eligiendo estados
   distintos cada vez, antes de reconectar. Verificar: al sincronizar, solo
   queda registrado el último valor elegido.

## Validación 5 — Falla permanente de sincronización

Forma más simple de reproducirla sin manipular la base a mano: revocar la
sesión mientras el dispositivo está offline (por ejemplo, cerrar sesión desde
otra pestaña con conexión) y luego reconectar el dispositivo con la cola
pendiente.

1. Con sesión admin, desconectar la red, marcar "Visto" en una mascota.
2. Sin reconectar ese dispositivo, invalidar la sesión (cerrar sesión desde
   otra pestaña/dispositivo, o esperar la expiración del token).
3. Reconectar la red en el primer dispositivo, navegando primero a una
   pantalla **distinta** de la ficha afectada (por ejemplo, la cuadrícula) —
   el aviso debe aparecer igual, porque es un banner global
   (`<SyncFailureBanner>`), no algo que dependa de estar mirando esa ficha.
4. Verificar: aparece un aviso explicando que el registro no se pudo
   sincronizar (no desaparece en silencio), con un control para descartarlo.
   Descartar y verificar que el registro pendiente desaparece de la cola sin
   haber tocado la base.

## Validación 6 — PWA instalable y actualización

1. `npm run build && npm run start`, abrir en Chrome mobile (o el emulador de
   dispositivo de DevTools). Verificar el prompt/opción de "Instalar app" o
   "Agregar a pantalla de inicio", con el ícono y el nombre correctos.
2. Abrir la app instalada desde el ícono — debe abrir en modo standalone
   (sin la barra de navegación del browser).
3. Hacer un cambio trivial en el código, rebuild y volver a servir sin cerrar
   la pestaña ya abierta. Verificar: aparece el aviso de "hay una versión
   nueva" con un botón de recargar — no se aplica solo sin avisar.

## Automatizado

```bash
npm run typecheck
npm run test              # incluye tests/unit/dates.test.ts, streak.test.ts,
                           # offline-queue.test.ts, sync-errors.test.ts
npm run test:e2e -- tests/e2e/offline-sighting.spec.ts
```

Ver `contracts/*.md` para el detalle de qué exactamente cubre cada test.

## Antes de dar la feature por terminada

Además del checklist estándar de `CLAUDE.md`:

- [ ] `npm run typecheck` pasa
- [ ] Un insert directo con la anon key contra `sightings` sigue fallando
      (RLS no cambió — esta feature no toca políticas)
- [ ] Ninguna imagen depende de una URL con expiración (sin cambios acá,
      verificar que el `CacheFirst` de fotos sigue usando la URL pública)
- [ ] El calendario y el control de marcado funcionan en 375px de ancho
- [ ] No se agregaron variables de entorno nuevas
- [ ] El HTML de servidor de `/` y `/mascotas/[slug]` con sesión admin no
      contiene "Editar", "Agregar hito" ni "Cerrar sesión"
      (`tests/e2e/anonymous-visibility.spec.ts`, `contracts/service-worker.md`)
- [ ] `*/auth/v1/**` no tiene ninguna entrada de caché en `app/sw.ts`
- [ ] Los tres estados del calendario se distinguen sin color (probado en
      escala de grises)
