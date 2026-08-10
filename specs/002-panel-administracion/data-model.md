# Data Model: Panel de administración

Ninguna de las tablas de abajo es nueva ni cambia de forma — están tal como
las aplicó `petdex-schema.sql` en la feature 1. Lo que agrega esta feature es
el **camino de escritura** (antes, estos datos solo se cargaban a mano en el
SQL Editor) y sus reglas de validación en el formulario. Los tipos generados
en `src/types/database.ts` no se tocan (Principio V).

## Entidad: `pets` (escritura)

| Campo | Columna | Tipo en formulario | Regla de validación (Zod, espejo del `check` de Postgres) |
|---|---|---|---|
| id | `id uuid` | oculto | Generado en el cliente al crear (`crypto.randomUUID()`), fijo en edición. Ver research.md §4. |
| nombre | `name text not null` | texto, obligatorio | `z.string().trim().min(1)` |
| apodos | `nicknames text[] not null default '{}'` | lista de chips, agregar/quitar de a uno | `z.array(z.string().trim().min(1)).default([])` |
| slug | `slug text unique not null` | texto, autogenerado, editable solo al crear | `z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)`. Ver research.md §5. |
| foto | `photo_url text` (nullable) | selector cámara/galería + preview + progreso | No es parte del esquema Zod del formulario en sí — se resuelve antes del submit a una URL pública o a `null`/`undefined` (ver `PhotoField` en data-model.md → Comportamiento). |
| zona | `zone text` (nullable) | texto corto | `z.string().trim().max(120).optional()` |
| ubicación de referencia | `location text` (nullable) | texto corto | `z.string().trim().max(200).optional()` |
| fecha de registro | `registered_on date not null default current_date` | date picker, default hoy | `z.coerce.date()` — se envía como fecha local (UTC-3), igual que `mark_sighting` en la feature 1 |
| edad estimada | `age_estimate text` (nullable) | texto libre ("~2 años", "cachorro") | `z.string().trim().max(60).optional()` |
| peso | `weight_kg numeric(5,2) check (> 0 o null)` | numérico, teclado numérico en mobile | `z.coerce.number().positive().max(999.99).optional().nullable()` |
| descripción | `description text` (nullable) | textarea | `z.string().trim().max(2000).optional()` |
| estado | `status text not null default 'activo' check (in (...))` | select, 4 opciones | `z.enum(['activo','sin_ver','adoptado','fallecido'])` — puramente informativo (FR-026), no afecta el catálogo público |

**Reglas de negocio no expresadas en el esquema de columna**:
- El slug se calcula una sola vez a partir de `name` en el momento de crear
  (`generateSlug`, research.md §5); en edición el campo se muestra pero es de
  solo lectura, sin importar cuántas veces cambie `name`.
- `updated_at` lo toca automáticamente el trigger `pets_touch_updated_at` — el
  formulario nunca lo envía.

## Entidad: `milestones` (escritura)

| Campo | Columna | Tipo en formulario | Regla de validación |
|---|---|---|---|
| id | `id uuid` | oculto | Generado por Postgres (`gen_random_uuid()` default) en alta; no se genera en el cliente porque no hay ningún recurso externo (como una foto) que necesite conocerlo de antemano. |
| pet_id | `pet_id uuid not null references pets(id)` | oculto, tomado de la URL (`[slug]` → `pets.id`) | — |
| título | `title text not null` | texto, obligatorio | `z.string().trim().min(1)` |
| fecha | `occurred_on date not null` | date picker, default hoy | `z.coerce.date()` |
| categoría | `category text check (in (...) or null)` | select, opcional | `z.enum(['salud','alimentacion','comportamiento','otro']).optional()` |
| nota | `note text` (nullable) | textarea, opcional | `z.string().trim().max(1000).optional()` |

**Borrado**: sin campo de formulario — botón + diálogo de confirmación que
exige que el texto mostrado nombre el hito (`title`) antes de habilitar el
botón de confirmar (FR-021).

## Entidad: `admins` (solo lectura desde la app)

No se agrega ningún formulario ni Server Action de escritura sobre esta
tabla. Sigue sin política de insert/update/delete (research.md §7) — dar de
alta o de baja a un administrador sigue siendo un paso manual en el dashboard
de Supabase, documentado en `CLAUDE.md`. La app solo la usa indirectamente a
través de `is_admin()` dentro de las políticas RLS de `pets`/`milestones`/
`storage.objects`.

## Pseudo-entidad: sesión

No es una tabla — es el estado de `supabase.auth` expuesto por
`@supabase/ssr`. Server Components/Actions la leen con `getUser()` (nunca
`getSession()`, ver research.md), que devuelve `{ user } | { user: null }`
tras validar el token contra el servidor de Auth. Un `user` no nulo no
implica ser administrador — eso lo determina exclusivamente `is_admin()` en
Postgres cuando la Server Action intenta escribir. La UI usa la presencia de
`user` solo para decidir qué mostrar (Principio I: "ocultar botones es
presentación, no seguridad").

## Comportamiento: subida de foto (`PhotoField`)

No es una entidad de base de datos — es el contrato entre el componente de
formulario y Supabase Storage, documentado acá porque varias reglas de
validación dependen de él:

| Paso | Detalle |
|---|---|
| Selección | `<input type="file" accept="image/*" capture>` — cámara o galería según elija el sistema operativo del teléfono. |
| Preview | `URL.createObjectURL(file)` inmediatamente al seleccionar, antes de comprimir. |
| Compresión | `createImageBitmap(file)` → dibujar en `<canvas>` con el lado mayor limitado a 1600px → `canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })`. |
| Validación previa | Tipo MIME de entrada debe estar entre los permitidos por el bucket (`image/jpeg`, `image/png`, `image/webp`, `image/avif`) — si no, error antes de intentar comprimir. |
| Subida | `supabase.storage.from('pet-photos').upload(path, blob, { contentType: 'image/webp' })` desde el navegador, con progreso expuesto vía el evento de subida del SDK. |
| Ruta | `{petId}/{Date.now()}.webp` — único por subida, nunca sobrescribe (research.md §4). |
| Quitar sin reemplazar | Limpia el campo `photo_url` en el formulario; la Server Action interpreta `photoUrl: null` como "borrar la foto existente" (FR-013). |

## Mapeo de errores Postgres → mensaje (`src/lib/errors.ts`)

| Código | Origen típico en esta feature | Mensaje al usuario |
|---|---|---|
| `23505` | Slug duplicado (carrera entre dos altas, o el chequeo de cliente se saltó) | "Ese identificador ya está en uso. Probá con otro." |
| `42501` | RLS rechazó la escritura (sesión sin admin, o sin sesión) | "No tenés permiso para hacer esto. Iniciá sesión con una cuenta autorizada." |
| Cualquier otro | — | "Algo salió mal. Intentá de nuevo." — el error crudo se registra con `console.error`, nunca se muestra. |
