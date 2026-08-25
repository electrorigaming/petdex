# Data Model: Rol Usuario, solicitud de cuenta y registro de modificaciones

## Cambios en Postgres

### `app_users` (tabla nueva, reemplaza `admins`)

| Campo | Tipo | Notas |
|---|---|---|
| `user_id` | `uuid primary key references auth.users(id) on delete cascade` | Mismo rol de PK que tenía `admins.user_id`. `cascade`: si la cuenta de Google se elimina de `auth.users`, no tiene sentido conservar una fila de rol sin usuario al que referir. |
| `email` | `text not null` | Copiado del email de Google en el momento del alta (manual o vía `claim_approved_account()`). No se sincroniza si el email de Google cambia después — fuera de alcance. |
| `display_name` | `text not null` | Nombre que se muestra en el panel de administración y en el historial (`pet_activity_log.actor_label` lo congela en cada evento). Para administradoras migradas, arranca igual al email; no editable desde la app. |
| `role` | `text not null check (role in ('admin','usuario'))` | Único lugar donde vive el rol de una cuenta. |
| `approved_by` | `uuid references auth.users(id) on delete set null` | Quién dio de alta la cuenta — la propia cuenta para administradoras migradas, la administradora que aprobó la solicitud para cuentas Usuario. Informativo, no se usa en ninguna policy. |
| `created_at` | `timestamptz not null default now()` | |

RLS completa (select propio/admin, delete solo de `role='usuario'` por admin,
sin insert/update para `authenticated`/`anon`) en research.md §1.

### `account_requests` (tabla nueva)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `email` | `text not null check (...)` | Formato básico validado también en la base, además de en el formulario (zod). |
| `display_name` | `text not null` | Nombre que la persona escribió al solicitar; se copia a `app_users.display_name` si se aprueba y se reclama. |
| `status` | `text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada'))` | |
| `user_id` | `uuid references auth.users(id) on delete set null` | `null` hasta que la solicitud se reclama en un login real (§ claim, research.md §3). Sirve para saber si ya se vinculó. |
| `reviewed_by` | `uuid references auth.users(id) on delete set null` | Qué administradora aprobó/rechazó. |
| `requested_at` | `timestamptz not null default now()` | |
| `reviewed_at` | `timestamptz` | `null` mientras está pendiente. |

Índice único parcial `lower(email)` donde `status = 'pendiente'` — evita
duplicados en la cola sin bloquear un reintento después de un rechazo. RLS
completa (insert público, lectura propia por email de JWT, lectura/edición
solo admin) en research.md §2.

### `pet_activity_log` (tabla nueva, de solo lectura para la app)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `pet_id` | `uuid not null references public.pets(id) on delete cascade` | Vive y muere con la mascota — ver "Trade-off aceptado" en spec.md. |
| `actor_id` | `uuid references auth.users(id) on delete set null` | Puede quedar `null` si la cuenta de Google se elimina más adelante; `actor_label` conserva el nombre igual. |
| `actor_label` | `text not null` | Congelado al momento del evento (research.md §5) — el historial no cambia retroactivamente si esa cuenta se renombra o se revoca. |
| `action` | `text not null check (action in ('mascota_creada','mascota_editada','hito_agregado','hito_editado','hito_eliminado','avistamiento_marcado'))` | No incluye `mascota_eliminada` — ver research.md §5, no sobreviviría al cascade. |
| `detail` | `text` (nullable) | Texto libre: título del hito para eventos de hito, fecha + estado para avistamientos, `null` para eventos de mascota. |
| `created_at` | `timestamptz not null default now()` | |

Índice `(pet_id, created_at desc)` para el orden cronológico que pide la
Historia de Usuario 2. RLS: solo `select` para `is_admin()`; ninguna policy de
escritura — la tabla se llena exclusivamente desde triggers `security
definer` en `pets`/`milestones`/`sightings` (research.md §5).

### `pets` (sin cambio de columnas, RLS ampliada — no reemplazada)

`created_by` (ya existente desde `005-tipo-privado-publico`) ahora puede
apuntar tanto a una cuenta administradora como a una cuenta Usuario — el
campo no distingue rol, siempre significó "quién puede ver/editar esta fila
cuando es Privada". Las tres políticas de administradora
(`pets_admin_insert`/`update`/`delete`) no cambian. Se suman tres políticas
nuevas, exclusivas del rol Usuario y solo sobre sus propias filas Privadas
(`pets_usuario_insert_private`/`update_own_private`/`delete_own_private`,
research.md §8) — Postgres las combina con las de admin vía OR, no las
reemplaza. `pets_select` tampoco cambia: ya era agnóstica de rol.

Consecuencia directa (sin política nueva para esto, ya se deriva de las
existentes): una administradora no ve, edita ni elimina una mascota Privada
creada por una cuenta Usuario — mismo aislamiento que ya regía entre dos
administradoras distintas (research.md §8).

### `milestones` / `sightings` (sin cambio de columnas, cambia RLS)

Las políticas de escritura pasan de `is_admin()` a `is_editor()`, conservando
la condición de ownership sobre `pets.visibility`/`created_by` ya introducida
por `005-tipo-privado-publico` — detalle completo en research.md §4. Como esa
condición no distingue rol, extiende automáticamente el mismo aislamiento a
las mascotas Privadas creadas por una cuenta Usuario, sin necesitar ningún
ajuste adicional.

### `storage.objects` (bucket `pet-photos`, sin cambio de columnas, RLS reemplazada)

Las tres políticas de escritura de `petdex-schema.sql` (`is_admin()` puro) se
reemplazan por versiones que verifican, para una cuenta Usuario, que la ruta
del archivo (`<petId>/...`) corresponda a una mascota que todavía no existe
(flujo de creación) o que ya sea su propia Privada — nunca a la de otra
cuenta ni a una Pública. Detalle completo, incluido por qué hace falta la
rama "todavía no existe fila", en research.md §9.

### `admins` (eliminada)

Se migra su contenido a `app_users` y se elimina — ver research.md §1.

## Tipos de aplicación

### `AppRole` (nuevo, `src/lib/auth.ts` o similar)

```ts
export const APP_ROLES = ["admin", "usuario"] as const
export type AppRole = (typeof APP_ROLES)[number]
```

### Sesión (`src/components/auth/session-provider.tsx`, `src/hooks/use-session.ts`)

El contexto de sesión deja de exponer solo `isAdmin` y pasa a resolver el rol
y, cuando no hay rol, el estado de la última solicitud propia — un único RPC
nuevo reemplaza la llamada a `rpc("is_admin")`:

```ts
type AccountStatus = {
  role: AppRole | null
  requestStatus: "pendiente" | "rechazada" | null
}

type SessionContextValue = {
  isAuthenticated: boolean
  isAdmin: boolean      // role === "admin"
  isEditor: boolean     // role === "admin" || role === "usuario"
  role: AppRole | null
  requestStatus: "pendiente" | "rechazada" | null
  email: string | null
  loading: boolean
}
```

`isAdmin`/`isEditor` quedan como derivados de `role` (misma superficie que ya
consumen los componentes existentes, para minimizar el diff en cada flip
listado en `plan.md`); `role`/`requestStatus` son los campos nuevos que
consume `AccessGate` (antes `AdminGate`) y el mensaje de "solicitud
pendiente". El RPC que los resuelve es una función SQL nueva (`stable`, no
mapeada 1:1 a una tabla) que junta `app_users`/`account_requests` por
`auth.uid()`/email de JWT — mismo criterio que ya usa `is_admin()` como fuente
única, sin duplicar la lógica de la policy en el cliente.

### Formulario y controles de mascota (`src/components/pets/pet-form.tsx` y hermanos)

`PetForm` pasa a leer `useSession().role` para decidir el campo Tipo:

- `role === "admin"`: sin cambios — radio Público/Privado editable, mismo
  comportamiento que `006-tipo-editable-formulario` (modo crear y editar).
- `role === "usuario"`: el radio de Tipo no se muestra; en modo crear, el
  valor enviado es siempre `"privado"` (no hay forma de que llegue otro valor
  al payload); en modo editar, el valor ya viene fijo en `"privado"` desde
  `initialValues` (research.md §8 garantiza que si una cuenta Usuario puede
  cargar la ficha de edición, la mascota ya es su propia Privada) y sigue sin
  poder cambiarse.

`EditPetButton`/`DeletePetButton`/`PetAdminActions` suman una prop
`visibility: PetVisibility` (ya disponible en `PetDetail`, no hace falta
extender `getPetBySlug()` — ver research.md §7 "Nota"). La condición de
visibilidad del botón pasa de `isAdmin` a
`isAdmin || (isEditor && visibility === "privado")` — si la mascota es
Pública, solo admin la edita/elimina; si es Privada y la cuenta puede leerla
(por RLS, `pets_select`), necesariamente es su propia creadora (admin o
Usuario), así que alcanza con `isEditor` sin volver a comprobar
`created_by` en el cliente.

### `PendingRequest` / `ActiveUser` (nuevo, panel `/admin/solicitudes`)

```ts
export type PendingRequest = {
  id: string
  email: string
  displayName: string
  requestedAt: string
}

export type ActiveUsuario = {
  userId: string
  email: string
  displayName: string
  createdAt: string
}
```

Vistas planas sobre `account_requests`/`app_users` filtradas del lado del
servidor (Server Component de `app/admin/solicitudes/page.tsx`, protegido por
RLS igual que cualquier otra lectura admin) — no necesitan una vista SQL
dedicada por el volumen esperado (Scale/Scope en `plan.md`).

### `ActivityEvent` (nuevo, sección Historial)

```ts
export type ActivityAction =
  | "mascota_creada" | "mascota_editada"
  | "hito_agregado" | "hito_editado" | "hito_eliminado"
  | "avistamiento_marcado"

export type ActivityEvent = {
  id: string
  actorLabel: string
  action: ActivityAction
  detail: string | null
  createdAt: string
}

export const ACTIVITY_ACTION_LABEL: Record<ActivityAction, string> = {
  mascota_creada: "creó la ficha",
  mascota_editada: "editó la ficha",
  hito_agregado: "agregó el hito",
  hito_editado: "editó el hito",
  hito_eliminado: "eliminó el hito",
  avistamiento_marcado: "marcó un avistamiento",
}
```

Se renderiza como `"{actorLabel} {ACTIVITY_ACTION_LABEL[action]}{detail ? \`: ${detail}\` : ""}"`,
en orden `created_at desc`.

## Relaciones

```text
auth.users (Supabase) 1──1 app_users (rol)
auth.users (Supabase) 0..1──0..1 account_requests (vía email, hasta reclamarse)
pets 1──* pet_activity_log (on delete cascade)
pets 1──* milestones (ya existente)
pets 1──* sightings (ya existente)
app_users (creadora) 0..1──* pets (created_by, solo relevante si visibility='privado';
                                    ya existía desde 005, ahora la creadora puede
                                    tener role='admin' o role='usuario' indistintamente)
app_users (actor) 1──* pet_activity_log (on delete set null; actor_label sobrevive)
```

`account_requests` no tiene una FK "dura" hacia `app_users` — la relación es
por `email` hasta que `claim_approved_account()` completa `user_id`, momento
en el que ya existe la fila correspondiente en `app_users` con ese mismo
`user_id` (dos tablas relacionadas por el mismo `auth.users.id`, no por FK
directa entre sí, porque `account_requests` puede existir sin que
`app_users` tenga todavía ninguna fila para esa persona).
