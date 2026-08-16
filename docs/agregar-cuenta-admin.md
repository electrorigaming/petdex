# Cómo agregar una cuenta administradora en PetDex

PetDex no tiene un panel para dar de alta administradoras ni una cuenta
"superadmin" — se hace a mano en Supabase, igual que se hace hoy para
marcar una mascota como privada. Todas las cuentas administradoras tienen
exactamente los mismos permisos, sin roles ni jerarquía entre ellas
(`CLAUDE.md`).

La garantía de que solo estas cuentas pueden escribir vive en la política
RLS `pets_admin_write` (y equivalentes en `milestones`/`sightings`), que
consulta la función `is_admin()`. Esa función solo revisa una cosa: si el
`user_id` de la sesión existe como fila en la tabla `public.admins`. Agregar
una admin es, ni más ni menos, insertar esa fila.

## Prerrequisito (una sola vez por proyecto)

Esto ya debería estar hecho si el login con Google ya funciona en producción
— sáltealo si es así.

1. En el dashboard de Supabase: **Authentication → Providers → Google**.
2. Cargar el **Client ID** y **Client Secret** de un proyecto de Google Cloud
   Console.
3. En Google Cloud Console, registrar como *Authorized redirect URI*:
   ```
   https://<tu-proyecto>.supabase.co/auth/v1/callback
   ```

## Paso a paso para agregar una cuenta administradora nueva

### 1. Que la persona inicie sesión una vez

La tabla `admins` referencia `auth.users(id)` — esa fila solo existe después
de que la persona se loguea con Google **al menos una vez**. Pedile que
entre a la app y toque "Iniciar sesión", complete el consentimiento de
Google, y listo. No hace falta que pueda hacer nada todavía: en este punto
el login funciona, pero cualquier intento de guardar algo va a fallar con un
mensaje de permisos genérico, porque su cuenta todavía no está en `admins`.

### 2. Insertar la fila en `admins`, directo por email

**Database → SQL Editor**, pegar y ejecutar (reemplazando el email) — no
hace falta buscar ni copiar ningún UUID, la propia consulta lo resuelve
contra `auth.users`:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'persona@example.com';
```

Eso es todo — `admins` no guarda email ni nombre, solo el `user_id` y una
fecha de alta automática. Si el `insert` no afecta ninguna fila, significa
que esa persona todavía no completó el paso 1 (su email no existe en
`auth.users` todavía).

**Tip**: guardá esta consulta en Supabase como *SQL Editor → Saved queries*
(le podés poner de nombre "Agregar admin") para no tener que volver a este
archivo cada vez — solo reemplazás el email y la corrés.

### 3. Verificar

Pedile a la persona que recargue la página (o vuelva a iniciar sesión si ya
tenía una pestaña abierta). Debería ver aparecer los controles de admin
("Agregar" mascota, botones de editar/borrar en las fichas). Si no aparecen,
confirmá con esta consulta que el `insert` realmente encontró y agregó a esa
persona:

```sql
select a.user_id, u.email
from public.admins a
join auth.users u on u.id = a.user_id
where u.email = 'persona@example.com';
```

Si no devuelve fila, el email tipeado no coincide exactamente con el que
usó para loguearse (mayúsculas, alias, etc.) — confirmalo en
**Authentication → Users**.

## Quitar una cuenta administradora

Simétrico al alta — borrar su fila de `admins` le saca los permisos de
escritura de inmediato, sin tocar `auth.users` (su cuenta de Google sigue
pudiendo iniciar sesión, solo que ya no es admin):

```sql
delete from public.admins
where user_id = (select id from auth.users where email = 'persona@example.com');
```

## Por qué no hay un botón para esto en la app

Porque la garantía tiene que vivir en la base, no en el código (Principio I
de `CLAUDE.md`). Un panel de "gestión de administradoras" dentro de la app
sería, en los hechos, una admin pudiendo darle permisos a cualquier otra
cuenta — un vector de escalada de privilegios que hoy no existe porque el
único camino es tener acceso directo al dashboard de Supabase. Es la misma
razón por la que el campo Tipo (Privado/Público) de las mascotas tampoco se
edita desde ningún formulario.
