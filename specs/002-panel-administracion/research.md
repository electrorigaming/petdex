# Research: Panel de administración

## 1. Variables de entorno y Google OAuth

**Decisión**: Google OAuth se configura enteramente en el dashboard de
Supabase (Authentication → Providers → Google, con Client ID/Secret de Google
Cloud Console cargados ahí). El código de la app nunca ve esas credenciales:
llama a `supabase.auth.signInWithOAuth({ provider: 'google', options: {
redirectTo } })`, y Supabase Auth resuelve el intercambio completo contra
Google usando la configuración de su propio dashboard.

**Rationale**: Esto significa que el conjunto de variables de entorno del
proyecto no cambia — sigue siendo exactamente `NEXT_PUBLIC_SUPABASE_URL` y
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. No hace falta `GOOGLE_CLIENT_ID` ni
`GOOGLE_CLIENT_SECRET` en `.env` ni en Vercel.

**Alternativas consideradas**: Implementar el flujo OAuth "a mano" contra la
API de Google (descartado — Supabase Auth ya lo resuelve, y hacerlo a mano
agregaría superficie de seguridad sin ningún beneficio).

**Prerrequisito manual** (fuera del código, documentado en quickstart.md):
1. Proveedor Google habilitado en Supabase Auth con credenciales válidas de
   Google Cloud Console.
2. Al menos una cuenta de Google ya insertada a mano en la tabla `admins`
   (mismo procedimiento manual que documenta `CLAUDE.md`).
3. El proveedor de email/contraseña de Supabase Auth sigue habilitado a nivel
   de proyecto (viene así por defecto) — no lo usa ningún usuario real, pero
   lo necesita el admin de prueba de la sección 6. Si alguna vez se
   deshabilita, la estrategia de testing de esa sección deja de funcionar.

## 2. Middleware: patrón de refresco de sesión

**Decisión**: `middleware.ts` sigue el patrón oficial de `@supabase/ssr`:

1. Crear `let response = NextResponse.next({ request })`.
2. Crear el cliente de servidor con `getAll()`/`setAll()` que escriben las
   cookies tanto sobre `request.cookies` como sobre `response.cookies`.
3. Llamar `await supabase.auth.getUser()` — esto es lo que efectivamente
   refresca el token si venció, y las cookies refrescadas quedan escritas en
   `response` como efecto secundario del paso anterior.
4. Si la ruta es una de las protegidas (`/mascotas/nueva`,
   `/mascotas/*/editar`, `/mascotas/*/hitos/**`) y no hay usuario, redirigir a
   `/login?next=<ruta original>` — pero construir el redirect copiando las
   cookies de `response` antes de devolverlo, nunca devolver un
   `NextResponse.redirect(...)` "limpio" sin esas cookies.
5. En cualquier otro caso, devolver el mismo objeto `response`.

**Rationale**: Romper el paso 4 (construir un response nuevo sin copiar
cookies) es la causa típica de que la sesión expire sola cada hora de forma
intermitente — un bug que no se reproduce en desarrollo porque ahí los
refreshes son menos frecuentes. El middleware **solo redirige por UX**; no
decide autorización — si alguien evita el middleware y llama la Server Action
directamente, RLS sigue siendo quien lo bloquea (Principio I).

**Alternativas consideradas**: Proteger las rutas del formulario únicamente
del lado del cliente (Client Component que redirige si no hay sesión) —
descartado: es peor UX (parpadeo del formulario antes de redirigir) y no
aporta nada que el middleware no haga mejor, ya que de cualquier forma RLS
sigue siendo la única garantía real.

## 3. Callback de OAuth

**Decisión**: `app/auth/callback/route.ts` es un Route Handler que recibe
`code` (y opcionalmente `next`) por query string, llama
`supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor (que
escribe las cookies de sesión en la respuesta), y redirige a `next` si es una
ruta relativa válida (rechazar cualquier valor que empiece con `//` o incluya
un esquema, para no habilitar un open redirect), o a `/` si no hay `next` o es
inválido.

**Rationale**: Esto no contradice la regla "las fotos nunca pasan por un
Route Handler" — esa regla es específicamente sobre el límite de body de las
funciones serverless de Vercel (~4.5 MB) para bytes de imagen. El callback de
OAuth solo recibe un `code` corto en la query string, no un archivo.

`?next=` es cómo sobrevive la intención de "volver a la pantalla desde la que
se intentó entrar" (FR-004) a través del round-trip completo por Google: el
middleware la agrega al redirigir a `/login`, el botón de login la reenvía a
`signInWithOAuth({ options: { redirectTo: '/auth/callback?next=' + next } })`,
y el callback la lee al final.

## 4. Subida de fotos: ruta y orden de operaciones

**Decisión — id de mascota antes de que exista la fila**: Al crear una
mascota nueva, el navegador genera el `id` (UUID v4, `crypto.randomUUID()`)
*antes* de subir la foto, y ese mismo UUID se usa (a) como prefijo de la ruta
de Storage (`{id}/{timestamp}.webp`) y (b) como `pets.id` explícito en el
insert de la Server Action. `pets.id` tiene `default gen_random_uuid()` en el
esquema, pero Postgres permite proveer el valor explícitamente en el insert —
no hace falta ninguna migración para esto.

**Rationale**: Sin esto, no hay forma de nombrar `{petId}/...` porque el id
todavía no existe (la fila todavía no se insertó) y la subida directa a
Storage tiene que pasar *antes* de tener una fila para poder mostrar el
progreso de subida y la preview durante el llenado del formulario. Generar el
id en el cliente resuelve el orden sin necesitar un paso de "subir a
staging y mover después".

**Orden de operaciones — alta (sin foto previa que borrar)**:
1. Cliente comprime y sube a `{id}/{timestamp}.webp` vía el browser client
   (anon key + sesión; permitido por `pet_photos_admin_write` porque
   `auth.uid()` está en `admins`).
2. Cliente llama a la Server Action con `id`, el resto de los campos, y la
   URL pública de la foto recién subida (o `null` si no se cargó foto).
3. Server Action inserta la fila. Si falla, el cliente borra el archivo recién
   subido (huérfano evitable) — peor caso real: un archivo huérfano si el
   cliente se cierra entre el paso 1 y el 3, nunca una mascota con foto rota.

**Orden de operaciones — reemplazo de foto en edición** (ya especificado por
el usuario, confirmado sin cambios): subir la nueva → Server Action actualiza
`photo_url` → recién entonces borrar la anterior. Si la escritura de la fila
falla, borrar el archivo recién subido.

**Orden de operaciones — quitar foto sin reemplazo (FR-013)**: Server Action
actualiza `photo_url = null` primero → recién entonces borrar el archivo
anterior de Storage. Mismo invariante que el reemplazo: peor caso es un
archivo huérfano, nunca una fila apuntando a un archivo que ya no está.

**Alternativas consideradas**: Subir a una ruta de "staging" y mover el
archivo después del insert — descartado, agrega un paso de `move` que puede
fallar a mitad de camino sin ganar nada frente a generar el id en el cliente.

## 5. Formularios: Zod compartido, slug, revalidación

**Decisión — Server Actions en archivo propio, no inline en `pets.ts`/
`milestones.ts`**: `createPet`/`updatePet` viven en `src/lib/actions/pets.ts`
y `createMilestone`/`updateMilestone`/`deleteMilestone` en
`src/lib/actions/milestones.ts`, cada archivo con `"use server"` a nivel de
módulo — no como directive inline dentro de cada función, que era el plan
original. **Motivo, descubierto durante la implementación**: Next.js rechaza
una Server Action inline en un módulo que un Client Component también
importe por un export *sincrónico* del mismo archivo — acá,
`milestone-timeline.tsx` importa `sortMilestones` (una función sync) desde
`src/lib/milestones.ts`, que también tenía las Server Actions inline; el
build falla con "It is not allowed to define inline 'use server' annotated
Server Actions in Client Components". Separar las escrituras a un archivo
dedicado con el directive a nivel de archivo evita el conflicto para
siempre, independientemente de qué helpers sincrónicos se agreguen después a
`pets.ts`/`milestones.ts`.

**Decisión — esquema Zod único**: `src/lib/validation/pet-schema.ts` y
`milestone-schema.ts` exportan el mismo objeto Zod que usa
`@hookform/resolvers/zod` en el cliente (comodidad, feedback inmediato) y que
la Server Action vuelve a correr sobre el payload recibido antes de tocar la
base (la validación que realmente vale, Principio I extendido a formularios).
`weight_kg` se valida como `z.coerce.number().positive().max(999.99)`
opcional/nullable, reflejando el `check (weight_kg > 0)` y la precisión
`numeric(5,2)` de la columna.

**Decisión — slug**: `generateSlug(name)` normaliza con `.normalize('NFD')`,
quita diacríticos (`replace(/[̀-ͯ]/g, '')`), pasa a minúsculas y
reemplaza cualquier corrida de caracteres no alfanuméricos por un solo guion,
recortando guiones al inicio/final. Se calcula una sola vez, al crear; en
edición el campo es de solo lectura (FR-016). Verificación de colisión en dos
capas: el cliente consulta `pets` por `slug` en vivo mientras se edita (lectura
pública, ya permitida por `pets_public_read`, sin necesitar una Server Action
extra) para dar feedback inmediato; la garantía real es la restricción
`unique` de la columna, expuesta como error `23505` si la verificación de
cliente se saltea o hay una carrera entre dos altas simultáneas.

**Decisión — `revalidatePath`**: Tanto `/` como `/mascotas/[slug]` ya se
renderizan dinámicamente en cada request (ambas rutas usan `cookies()` a
través de `lib/supabase/server.ts`, lo que en App Router fuerza render
dinámico; `/mascotas/[slug]` además ya declara `revalidate = 0` desde la
feature 1). No hay caché de datos del lado del servidor que invalidar. Lo que
`revalidatePath` sí invalida es la **Router Cache del lado del cliente** de
Next.js — sin esto, navegar con `<Link>` a una página recién editada puede
mostrar la versión servida antes de la escritura. Por eso cada Server Action
de escritura llama `revalidatePath('/')` y, cuando aplica,
`revalidatePath('/mascotas/[slug]', 'page')` para el slug afectado.

Para hitos, la actualización visible sin recargar (FR-019/FR-020) no depende
de esto: la Server Action devuelve el hito creado/editado/borrado y el
componente cliente de la timeline actualiza su estado local directamente con
ese valor — más simple y predecible que confiar en el timing de la Router
Cache. `revalidatePath` sobre la ficha se sigue llamando igual, para que una
carga completa posterior (o de otra persona) ya vea el dato fresco.

**Alternativas consideradas**: Confiar en `router.refresh()` del lado del
cliente para los hitos — descartado en favor de actualizar el estado local
directamente con lo que devuelve la Server Action, que no depende de que el
Server Component vuelva a ejecutar ni tiene el parpadeo de un refetch.

## 6. Testing sin service role key: sesión admin real en tests

Este es el problema central de esta sección de research. Con login
exclusivamente por Google, no existe una credencial de email/contraseña
scripteable para simular "sesión de administrador" en Vitest, y automatizar
el consentimiento real de Google en Playwright es frágil y a menudo bloqueado
por el propio Google (CAPTCHAs, detección de automatización).

**Decisión**: Se crea **un único usuario de prueba dedicado** en Supabase
Auth, con contraseña habilitada (el proyecto sigue teniendo el proveedor
email/contraseña activo a nivel de Supabase Auth aunque la UI de la app nunca
lo exponga), y se agrega su `user_id` a la tabla `admins` con el mismo
procedimiento manual que cualquier otro admin. Sus credenciales viven en
`TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` en `.env.local` (que
`vitest.setup.ts` ya carga) — nunca en Vercel, nunca importadas por código de
la app, solo leídas por el arnés de tests.

**Por qué esto no viola el Principio I ("sin service role key")**: la
restricción de la constitución es específicamente sobre la *service role
key*, que salta RLS por completo. Este admin de prueba es una fila real de
`admins` con exactamente los mismos privilegios que cualquier administrador —
`signInWithPassword` solo cambia *cómo* se obtiene el JWT, no *qué* puede
hacer ese JWT. El test que usa este usuario está probando la política RLS
real, no evitándola.

**Vitest (RLS positivo)**: `tests/integration/rls-*-write.test.ts` gana un
segundo bloque además del ya existente ("anon falla con 42501"): iniciar
sesión con `signInWithPassword(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)` sobre
el cliente de test, y confirmar que el mismo insert/update/delete que falla
para anon tiene éxito para esa sesión.

**Playwright (E2E)**: intentar automatizar el botón "Continuar con Google"
contra la pantalla de consentimiento real de Google no es viable de forma
confiable en CI. En cambio, `tests/e2e/global-setup.ts` abre un contexto de
navegador real, navega a una ruta que ejecuta
`supabase.auth.signInWithPassword(...)` **con el cliente de navegador**
(nunca construyendo las cookies a mano — el formato exacto de las cookies
`sb-<ref>-auth-token` fragmentadas es un detalle interno de `@supabase/ssr`
que no hay que replicar), espera a que el cliente de `@supabase/ssr` escriba
sus propias cookies, y guarda el `storageState` resultante. Los specs E2E
autenticados (`admin-flow.spec.ts`) arrancan con ese `storageState`; el spec
de visibilidad anónima (`anonymous-visibility.spec.ts`) corre en un proyecto
de Playwright separado, sin `storageState`.

Esto redefine el alcance real de la cobertura E2E de "login" pedida
originalmente: se prueba que *estando* logueado los controles aparecen y
funcionan, y que el botón de cerrar sesión efectivamente cierra la sesión —
no se prueba el clic a través de la pantalla de consentimiento de Google en
sí, porque automatizar eso de forma confiable no es factible con las
herramientas disponibles.

**Alternativas consideradas**: Mockear `supabase.auth` por completo en los
tests — descartado porque no prueba nada real sobre RLS, que es exactamente
lo que este conjunto de tests existe para verificar. Usar la Admin API de
Supabase (`auth.admin.createUser`/`generateLink`) para fabricar una sesión —
descartado porque esa API requiere la service role key, prohibida sin
excepciones por el Principio I incluso para testing.

## 7. Confirmación: sin migraciones nuevas

**Decisión**: No se generan migraciones para esta feature.

**Verificación contra el esquema ya aplicado** (`petdex-schema.sql`):
- `admins` tiene únicamente la política `admins_self_read` (select, a
  `authenticated`, `using (is_admin())`) — **no existe ninguna política de
  insert/update/delete** sobre esa tabla. Esto es intencional: autorizar o
  desautorizar un admin sigue siendo, después de esta feature, un
  procedimiento manual en el dashboard de Supabase, tal como documentan la
  constitución y `CLAUDE.md`. Ninguna Server Action de esta feature intenta
  escribir en `admins`.
- `is_admin()` verifica pertenencia a `admins` por `auth.uid()`, sin ningún
  chequeo sobre el proveedor de autenticación usado — funciona igual para una
  fila de `auth.users` creada por Google OAuth que por email/contraseña (el
  admin de prueba de la sección 6).
- `pets_admin_write`, `milestones_admin_write` y las tres políticas de
  Storage (`pet_photos_admin_write/update/delete`) ya usan `is_admin()` como
  única condición — cubren génericamente cualquier cantidad de administradores
  sin cambio alguno.
