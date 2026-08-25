# Contracts: Server Actions nuevas

Mismo patrón que ya documentó `002-panel-administracion/contracts/mutations.md`:
cada Action valida con Zod, llama `getUser()` solo para un mensaje temprano, y
la garantía real es la policy RLS correspondiente (`contracts/database.md`).

## `createPet(input)` — sin cambios de firma, `src/lib/actions/pets.ts`

Con el rol Usuario, una cuenta no-admin ahora puede llamar a esta Action.
`petFieldsSchema`/el formulario nunca le ofrecen `visibility: "publico"`
(contracts/database.md, data-model.md — `PetForm` por rol), así que en la
práctica el payload de una cuenta Usuario siempre trae `visibility:
"privado"`. La garantía real sigue siendo la política (ahora también
`pets_usuario_insert_private`, research.md §8): un intento directo con
`visibility: "publico"` desde una cuenta Usuario, sin pasar por el
formulario, falla igual con `42501`.

## `updatePet(id, input)` / `deletePet(id)` — cambio de comportamiento, `src/lib/actions/pets.ts`

**Cambio**: ambas Actions ahora detectan cuando la política RLS rechazó la
operación silenciosamente (cero filas afectadas — Postgres no reporta esto
como `error` en un `update`/`delete`) y devuelven `{ ok: false, message: "No
tenés permiso para editar/eliminar esta mascota." }` en vez de un falso
`{ ok: true, ... }`. `updatePet` lo detecta encadenando `.select().maybeSingle()`
y chequeando `data === null`; `deletePet` usa `.delete({ count: "exact" })` y
chequea `count === 0`. Ver research.md §10 para el porqué (el rol Usuario es
la primera cuenta que puede leer una mascota Pública sin poder escribirla, así
que es la primera vez que este camino es alcanzable sin manipular la red a
mano).

**Garantía real**: sin cambios — sigue siendo `pets_admin_update`/`delete`
(admin) más, ahora, `pets_usuario_update_own_private`/`delete_own_private`
(Usuario sobre su propia Privada). Este cambio es enteramente de mensajería
de la Action, no de la política.

## `submitAccountRequest(input)` — `src/lib/actions/account-requests.ts`

**Quién la llama**: cualquiera, con o sin sesión — el formulario público en
`/login`.

**Input** (`accountRequestSchema`, Zod):
```ts
{ email: string, displayName: string }
```
Sin `honeypot` obligatorio en el contrato de datos, pero el componente de
formulario puede sumar un campo oculto anti-spam que la Action ignora si
llega vacío y descarta el envío si llega lleno — decisión de implementación,
no de este contrato.

**Output**:
- Éxito: `{ ok: true }` — el formulario muestra un mensaje de confirmación,
  no redirige (no hay sesión necesariamente activa).
- Error: `{ ok: false, message }` — incluye el caso "ya hay una solicitud
  pendiente con ese email" (mapeado desde la violación del índice único
  parcial, `23505`).

**Efectos secundarios**: ninguno (`revalidatePath` no aplica — nada en el
árbol público depende de `account_requests`).

**Garantía real**: `account_requests_public_insert` (`with check (status =
'pendiente' and user_id is null and reviewed_by is null and reviewed_at is
null)`).

## `approveRequest(id)` / `rejectRequest(id)` — `src/lib/actions/account-requests.ts`

**Quién la llama**: una cuenta admin, desde `/admin/solicitudes`.

**Input**: `{ id: string }` (uuid de la solicitud).

**Output**: `{ ok: true } | { ok: false, message }`.

**Efectos secundarios**: `revalidatePath('/admin/solicitudes')`.

**Garantía real**: `account_requests_admin_review` (`is_admin()`). La Action
setea `status` (`'aprobada'`/`'rechazada'`), `reviewed_by = user.id`,
`reviewed_at = now()` en el mismo `update`.

**Nota**: aprobar **no** otorga acceso todavía — solo marca la solicitud;
`claim_approved_account()` (contracts/database.md) es quien de verdad crea la
fila en `app_users`, en el próximo login de esa persona. La UI del panel debe
dejar esto explícito (spec.md, User Story 3, Acceptance Scenario 3).

## `revokeUsuario(userId)` — `src/lib/actions/account-requests.ts`

**Quién la llama**: una cuenta admin, desde `/admin/solicitudes`.

**Input**: `{ userId: string }`.

**Output**: `{ ok: true } | { ok: false, message }`.

**Efectos secundarios**: `revalidatePath('/admin/solicitudes')`. No hace
falta `revalidatePath` sobre rutas públicas — la próxima escritura de esa
cuenta ya es rechazada por RLS sin importar el cache de Next.js.

**Garantía real**: `app_users_admin_revoke_usuario` (`is_admin() and
role = 'usuario'`) — un `delete` sobre `app_users`. La cuenta revocada
conserva su sesión de Google (`auth.users` no se toca) pero pierde
`is_editor()` de inmediato en el próximo chequeo de policy.

## RPC de estado de cuenta — llamado desde `session-provider.tsx`

**Quién la llama**: el cliente, una vez por resolución de sesión (mismo punto
donde hoy se llama `rpc("is_admin")`).

**Output**: `{ role: "admin" | "usuario" | null, requestStatus: "pendiente" | "rechazada" | null }`.

**Consumo en `AccessGate`** (antes `AdminGate`):

| `isAuthenticated` | `role` | `requestStatus` | Pantalla |
|---|---|---|---|
| `false` | — | — | App normal (visitante) |
| `true` | `"admin"` \| `"usuario"` | — | App normal, con los controles que correspondan al rol |
| `true` | `null` | `"pendiente"` | "Tu solicitud está pendiente" |
| `true` | `null` | `"rechazada"` \| `null` | Pantalla de "esta cuenta no tiene acceso" (variante de `NotAdminScreen`), con un link al formulario de `/login` para solicitar |

## `app/auth/callback/route.ts` (no es una Server Action, pero es parte del contrato de login)

Cambio puntual: después de `exchangeCodeForSession(code)` exitoso, y antes del
`redirect`, se llama `await supabase.rpc("claim_approved_account")` — sin
leer ni usar su resultado (`returns void`), solo se ejecuta por su efecto
secundario. Si falla (cualquier error de red/RPC), el login sigue
completándose igual — la próxima vez que esa persona inicie sesión,
`claim_approved_account()` se vuelve a intentar (es idempotente, ver
research.md §3), así que no hace falta bloquear el redirect ni mostrar un
error por esto.
