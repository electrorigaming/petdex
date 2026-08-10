# Contract: Flujo de autenticación

## Rutas involucradas

| Ruta | Rol |
|---|---|
| `/login` | Pantalla A. Un solo botón: "Continuar con Google". Sin campos de email/contraseña en la UI real de la app (research.md §6 explica por qué el proveedor de contraseña sigue existiendo a nivel de Supabase Auth, solo para testing). |
| `/auth/callback` | Route Handler. Recibe `code` (+ `next` opcional) de Supabase tras el consentimiento de Google, intercambia el `code` por sesión, redirige. |
| `middleware.ts` | Refresca la sesión en cada request; redirige rutas protegidas sin sesión a `/login?next=...`. No decide autorización (research.md §2). |

## Secuencia — login exitoso

1. Visitante sin sesión navega a una ruta protegida (ej. `/mascotas/nueva`).
2. `middleware.ts` no encuentra usuario válido (`getUser()`) → redirige a
   `/login?next=/mascotas/nueva`.
3. `/login` renderiza el botón. Al hacer clic, el Client Component llama
   `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo:
   `${origin}/auth/callback?next=/mascotas/nueva` } })`.
4. El navegador va a Google, el usuario consiente, Google vuelve a Supabase,
   Supabase redirige al navegador a `/auth/callback?code=...&next=/mascotas/nueva`.
5. `/auth/callback` llama `exchangeCodeForSession(code)` con el cliente de
   servidor (escribe las cookies de sesión en la respuesta) y redirige a
   `next` si es una ruta relativa válida (rechaza `next` que empiece con `//`
   o incluya un esquema — FR-004 no debe habilitar un open redirect), o a `/`
   en cualquier otro caso.
6. El usuario llega a `/mascotas/nueva` ya autenticado. Si su cuenta de Google
   **no** está en `admins`, la pantalla se muestra igual (hay `user`, no hay
   forma de saber de antemano si es admin sin intentar escribir — FR-003: no
   revelar membresía) pero cualquier intento de guardar falla con `42501`,
   mapeado a un mensaje genérico de permisos.

## Secuencia — logout

1. Usuario hace clic en "Cerrar sesión" (visible en toda la app cuando hay
   sesión, FR-005).
2. Client Component llama `supabase.auth.signOut()` sobre el cliente de
   navegador, que limpia las cookies de `@supabase/ssr`.
3. Redirección a `/` (o se queda en la misma página pública si ya estaba en
   una) — los controles de edición desaparecen porque `getUser()` vuelve a
   devolver `null` en el próximo render de servidor.

## Contrato de `middleware.ts`

**Rutas protegidas** (redirigen a `/login?next=<ruta>` sin sesión):
`/mascotas/nueva`, `/mascotas/*/editar`, `/mascotas/*/hitos/**`.

**Todas las demás rutas**: el middleware solo refresca cookies de sesión, sin
redirigir por autorización — `/` y `/mascotas/[slug]` siguen siendo públicas
sin sesión, mostrando los mismos datos que antes de esta feature (FR-022).

**Garantía real detrás de esta protección**: ninguna. Es exclusivamente UX —
si alguien evita el middleware y llama a una Server Action de escritura
directamente sin sesión (o con sesión pero sin estar en `admins`), la política
RLS correspondiente la rechaza con `42501` igual (FR-023, Principio I).
