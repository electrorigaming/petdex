# PetDex — Estado actual de la UI y funciones (para rediseño)

Inventario de pantallas, componentes y funciones tal como existen hoy en el
código, pensado como contexto de entrada para una sesión de rediseño (Claude
Design / `ui-ux-pro-max`). No es un documento de reglas de diseño — para eso
está `design-system/MASTER.md` (tokens, paleta, tipografía), que sigue siendo
la fuente de verdad de cómo se ve cada cosa. Esto es un mapa de qué hay y qué
hace cada pantalla, para poder discutir mejoras con contexto completo en vez
de adivinar el estado actual.

Generado a partir del código en `master` (commit posterior a
`003-seguimiento-offline` + una tanda de ajustes: botón eliminar mascota,
pantalla de bloqueo para cuentas no-admin, renombre "Dar de alta" →
"Agregar", corrección manual de fecha en el calendario).

---

## 1. Pantallas

| Ruta | Quién la ve | Propósito |
|---|---|---|
| `/` | Pública | Cuadrícula/lista de mascotas, contador, búsqueda por nombre/apodo, filtro por zona, botón "Agregar" (solo admin) |
| `/mascotas/[slug]` | Pública | Ficha de una mascota: foto, datos, calendario de avistamientos, timeline de hitos. Botones "Editar"/"Eliminar" y "Corregir un día anterior" solo admin |
| `/mascotas/nueva` | Solo admin (protegida por `middleware.ts`) | Alta de mascota — mismo formulario que edición (`<PetForm>`) |
| `/mascotas/[slug]/editar` | Solo admin | Edición de mascota, mismo `<PetForm>` con datos precargados |
| `/mascotas/[slug]/hitos/nuevo` | Solo admin | Alta de un hito |
| `/mascotas/[slug]/hitos/[hitoId]/editar` | Solo admin | Edición de un hito |
| `/login` | Pública | Login exclusivamente con Google (`<LoginButton>`) |
| `/auth/callback` | — | Route handler, intercambia el código OAuth por sesión y redirige a `next` |
| `/offline` | Pública | Fallback del service worker cuando una navegación falla sin conexión y esa página nunca se cacheó |
| `/test/login` | Solo en tests | Login por email/password contra `TEST_ADMIN_EMAIL`, usado por Playwright — nunca en producción real |

No hay pantalla de perfil, ajustes, ni notificaciones — el alcance de v1
(`CLAUDE.md`) las deja explícitamente afuera.

### Pantalla nueva: bloqueo para cuenta no-admin

Cualquier cuenta de Google que complete el login pero no esté en la tabla
`admins` ve, en **cualquier ruta**, una pantalla de bloqueo en vez del
contenido normal: ícono, "Esta cuenta no tiene acceso", un párrafo
explicativo, y el botón "Cerrar sesión" como única acción disponible.
Implementada en `src/components/auth/admin-gate.tsx` +
`src/components/auth/not-admin-screen.tsx`, montada en `app/layout.tsx`
envolviendo todo el contenido bajo el header. Antes de este cambio, cualquier
cuenta de Google podía iniciar sesión y ver los controles de administración
(que fallaban silenciosamente al usarlos, porque RLS los rechaza) — ahora el
login funcionalmente solo "sirve" para cuentas autorizadas, aunque Google
Sign-In en sí no puede restringirse por email de antemano.

---

## 2. Componentes por área

### Catálogo (`/`)

- **`<PetGrid>`** — contador grande (`text-display`), `<ViewToggle>`
  (cuadrícula/lista, preferencia en `localStorage`), buscador (`<Input
  type="search">` con ícono), `<Select>` de zona (solo si hay más de una
  zona con mascotas), grilla de `<PetCard>` o `<NoResultsState>`.
- **`<PetCard>`** — foto (o ícono `ImageOff` si no tiene), nombre, zona con
  ícono de pin. Toda la tarjeta es un `<Link>`.
- **`<EmptyState>`** / **`<NoResultsState>`** — mensajes centrados, sin
  ilustración, solo texto + un ícono chico en el caso de "sin resultados".
- **`<AddPetButton>`** ("Agregar", ex "Dar de alta") — solo visible con
  sesión admin, arma su propio JSX en cliente (no filtra el texto del botón
  al HTML servido a un visitante sin sesión).

### Ficha de una mascota (`/mascotas/[slug]`)

- **`<PetDetail>`** — foto grande (`aspect-[3/2]`), nombre, apodos, zona,
  fecha de registro, grilla de 2 columnas con ubicación/edad/peso (solo los
  campos que tengan valor), descripción en texto libre.
- **`<EditPetButton>`** / **`<DeletePetButton>`** (nuevo) — fila alineada a
  la derecha arriba de la foto, solo admin. Eliminar abre un `<Dialog>` de
  confirmación ("¿Eliminar a {nombre}? Se borran también sus hitos y
  avistamientos. Esta acción no se puede deshacer."), redirige a `/` al
  confirmar.
- **`<PetSightingsSection>`** — coordina todo lo de abajo:
  - **`<MarkTodayControl>`** — dos botones grandes ("Visto hoy" / "Revisado
    y no estaba"), objetivo táctil de 48px, feedback optimista, badge de
    reloj si está pendiente de sincronizar (offline).
  - **`<SightingCalendar>`** — grilla mensual, navegación mes anterior/
    siguiente acotada a `[registered_on, hoy]`, cada día es un `<DayCell>`.
  - **`<DayCell>`** — círculo relleno+check (visto), círculo con
    borde+X (revisado y no estaba), círculo punteado vacío (sin registro);
    badge de reloj superpuesto si está pendiente. Forma+ícono distinguen los
    estados, nunca solo color.
  - **`<MonthSummary>`** — "Vistos este mes" + "Racha actual", dos números
    grandes lado a lado.
  - Botón **"Corregir un día anterior"** (nuevo) — abre `<PastDayDialog>`
    en modo con selector de fecha (`<Input type="date">`, acotado a
    `[registered_on, ayer]`), para no tener que navegar el calendario mes a
    mes buscando un día olvidado. El click directo sobre un `<DayCell>`
    pasado sigue abriendo el mismo diálogo pero con la fecha ya fija (sin
    selector).
  - **`<PastDayDialog>`** — título dinámico según el modo, dos botones
    ("Revisado y no estaba" / "Visto"), error inline si falla (nunca
    encola: corregir un día pasado siempre requiere conexión).
- **`<MilestoneTimeline>`** — lista de tarjetas (fecha, título, categoría en
  `<Badge>`, nota opcional), botón de invertir orden, "Agregar hito" y
  editar/borrar por hito, todo solo admin.

### Formularios (alta/edición de mascota y de hito)

- **`<PetForm>`** — nombre, apodos, zona, ubicación, fecha de registro,
  edad estimada (texto libre), peso, descripción, estado
  (activo/sin_ver/adoptado/fallecido), `<PhotoField>`.
- **`<PhotoField>`** — compresión en cliente antes de subir (máx. 1600px,
  WebP, Principio IV de `CLAUDE.md`), preview, estado "Subiendo foto…".
- **`<SlugField>`** — genera el slug a partir del nombre, editable a mano.
- **`<MilestoneForm>`** — título, fecha, categoría (select), nota.
- **`<DeleteMilestoneDialog>`** — mismo patrón de confirmación que
  `<DeletePetButton>` (ícono `Trash2`, diálogo, "Esta acción no se puede
  deshacer").

### Auth / sesión

- **`<SessionProvider>`** — única suscripción a la sesión de Supabase de
  toda la app; ahora también resuelve `isAdmin` vía `rpc("is_admin")`.
- **`<AdminOnly>`** — oculta `children` mientras no hay sesión (o está
  resolviendo). Usado donde una acción debe estar oculta pero no bloquear
  toda la pantalla.
- **`<AdminGate>`** (nuevo) — envuelve toda la app bajo el header; si hay
  sesión pero no es admin, reemplaza el contenido por `<NotAdminScreen>`.
- **`<LoginButton>`** — un solo botón "Continuar con Google".
- **`<LogoutButton>`** — "Cerrar sesión", visible en el header para
  cualquier cuenta autenticada (admin o no).
- **`<SessionNavLink>`** — en el header: "Iniciar sesión" o
  `<LogoutButton>` según haya sesión.

### Offline / PWA

- **`<OfflineBanner>`** — "Sin conexión — mostrando datos de las HH:mm",
  franja angosta debajo del header.
- **`<UpdateAvailableBanner>`** — "Hay una versión nueva de PetDex
  disponible" + botón "Recargar", franja azul arriba de todo.
- **`<SyncFailureBanner>`** — aviso global (no depende de estar en la ficha
  afectada) cuando un marcado offline falla de forma permanente; nombre de
  la mascota como link + motivo + botón de descartar.
- Pantalla `/offline` — ícono `WifiOff`, mensaje, sin ninguna acción (es un
  fallback estático).

### Primitivas (`src/components/ui/`)

shadcn/ui de base: `Button` (variantes default/outline/ghost/icon),
`Card`, `Dialog`, `Input`, `Label`, `Select`, `Textarea`, `Badge`,
`Skeleton`. Sin componentes de tabla, tabs, tooltip, ni toast — no se usan
en ninguna pantalla actual.

---

## 3. Funciones y reglas de negocio visibles en la UI

- **Autorización**: pública para leer, admin para escribir — reforzado en
  tres capas: RLS (única garantía real), `<AdminOnly>`/`<AdminGate>` en el
  cliente (evita mostrar controles inútiles), y ahora la pantalla de
  bloqueo (evita que una cuenta no-admin use la app como si lo fuera).
- **Tres estados de avistamiento**, nunca dos: visto / revisado y no
  estaba / sin registro (ausencia de fila) — ver `<DayCell>`.
- **Racha**: corta en "revisado y no estaba", ni corta ni extiende en "sin
  registro", cuenta el pendiente offline como si ya estuviera confirmado.
- **Corrección de días pasados**: dos caminos a la misma acción — click en
  el calendario (fecha fija) o el botón "Corregir un día anterior" (fecha
  editable). Ninguno de los dos guarda hora, solo día — la app trata
  "¿se vio ese día?" como la pregunta relevante, no "¿a qué hora?".
- **Offline**: marcar "hoy" funciona sin conexión (cola en IndexedDB,
  sincroniza sola); corregir un día pasado siempre requiere conexión.
- **Fotos**: comprimidas en cliente, URL pública permanente, nunca una
  signed URL.
- **Eliminar una mascota** (nuevo): borra en cascada hitos y avistamientos,
  limpia la foto del storage, requiere confirmación explícita, sin
  posibilidad de deshacer desde la UI.

---

## 4. Sistema de diseño vigente (resumen — ver `MASTER.md` para el detalle)

- Minimalism & Swiss Style, un solo acento (`#2563EB`), sin gradientes ni
  decoración.
- Tipografía única (Inter), jerarquía por peso/tamaño, nunca menos de 16px
  en mobile.
- Escala de espaciado de 8px.
- Mobile-first (375/768/1024/1440), objetivo táctil mínimo 48px para el
  control de marcado.
- Estados distinguibles sin color (forma + ícono).
- `prefers-reduced-motion` respetado globalmente.

---

## 5. Oportunidades para una sesión de rediseño

Observaciones objetivas sobre el estado actual, sin prescribir una solución
— para que la sesión de rediseño las evalúe con el resto del contexto:

- **Estados vacíos son solo texto.** `<EmptyState>` y `<NoResultsState>` no
  tienen ilustración ni ícono grande; podría valer la pena revisar si eso
  alcanza para el caso "todavía no hay ninguna mascota" (primera vez que
  alguien abre la app).
- **Cinco combinaciones visuales en `<DayCell>`** (3 estados × pendiente/no,
  menos "sin registro" que no tiene variante pendiente) conviven en un
  círculo de 36px con un badge superpuesto — vale la pena un chequeo visual
  a 375px con el badge de reloj activo, es el elemento más denso de toda la
  app.
- **Dos entradas distintas a la misma acción** (click en un día del
  calendario vs. el nuevo botón "Corregir un día anterior") — funcionalmente
  correctas, pero valdría la pena decidir si conviene unificar la
  affordance visual entre ambas o dejarlas diferenciadas a propósito.
- **La pantalla de bloqueo (`<NotAdminScreen>`) es nueva y minimalista a
  propósito** (mismo tono que el resto de la app) — es la primera pantalla
  puramente de "error/estado", no hay otras con las que compararla para
  verificar consistencia.
- **Botones "Editar"/"Eliminar" en la ficha son del mismo tamaño y
  variante** (`outline`), diferenciados solo por texto/ícono — a diferencia
  del patrón ya usado en hitos (`ghost` + ícono solo para editar/borrar).
  Vale la pena decidir un único patrón para "acciones destructivas cerca de
  acciones no destructivas" en toda la app.
- **Sin confirmación de "deshacer" ni papelera** en ninguna acción
  destructiva (eliminar mascota, eliminar hito) — el diálogo de
  confirmación es la única red de seguridad.
- **El buscador y el filtro de zona son server-agnostic** (filtran en
  cliente sobre los datos ya cargados) — funciona bien a la escala actual
  (decenas de mascotas), pero es un límite a tener en cuenta si el catálogo
  crece mucho.
