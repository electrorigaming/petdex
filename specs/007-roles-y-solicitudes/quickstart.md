# Quickstart: validar rol Usuario, solicitud de cuenta e historial

## Prerrequisitos

- Migración aplicada: correr la migración de esta feature (ver `plan.md` —
  `supabase/migrations/`) en el proyecto de Supabase.
- Tipos regenerados y verificados:
  ```bash
  npm run gen:types
  npm run typecheck
  ```
- Una cuenta administradora de prueba con sesión iniciada (ya existente).
- Una segunda cuenta de Google real (o una cuenta de prueba por contraseña,
  para los tests automatizados — research.md §6) que todavía **no** esté en
  `app_users`, para probar el flujo de solicitud de punta a punta.
- Al menos una mascota pública existente para probar hitos/avistamientos con
  la cuenta Usuario.

## Escenario 1 — Cuenta Usuario edita hitos/avistamientos y gestiona sus propias mascotas privadas (User Story 1)

1. Dar de alta a mano una cuenta Usuario (vía SQL Editor, mismo criterio que
   hoy para administradoras):
   ```sql
   insert into public.app_users (user_id, email, display_name, role, approved_by)
   values ('<uuid-de-la-cuenta>', '<email>', '<nombre>', 'usuario', '<uuid-de-un-admin>');
   ```
2. Iniciar sesión con esa cuenta — **esperado**: la app carga normal, sin
   pantalla de bloqueo.
3. Abrir la ficha de una mascota **pública** existente, agregar un hito,
   editarlo y eliminarlo — **esperado**: las tres operaciones funcionan igual
   que con una cuenta admin.
4. Marcar el día de hoy como visto, y luego corregirlo a "revisado y no
   estaba" — **esperado**: el calendario y la cuadrícula reflejan el cambio
   sin recargar.
5. En esa misma mascota pública, o en la cuadrícula — **esperado**: ningún
   botón de editar/eliminar mascota visible (sí el de "Agregar" en el header
   o en el estado vacío).
6. Tocar "Agregar mascota", completar el formulario — **esperado**: no
   aparece el campo Tipo en absoluto (a diferencia de lo que ve una cuenta
   admin); al guardar, la mascota queda creada como Privada.
7. Abrir la ficha de esa mascota recién creada — **esperado**: los botones de
   editar y eliminar sí aparecen (es propia); editar un dato (por ejemplo la
   descripción) y guardar funciona con normalidad; el campo Tipo tampoco
   aparece en el formulario de edición.
8. Eliminarla — **esperado**: se borra, con la misma franja de Deshacer que
   ya existe para administradoras; "Deshacer" la restaura con normalidad.
9. Sin sesión, o con la sesión de la cuenta admin de prueba, buscar esa misma
   mascota (antes de eliminarla en el paso 8) en la cuadrícula o por su URL
   directa — **esperado**: invisible para ambas, igual que ya pasa hoy entre
   dos administradoras con una Privada.
10. (Verificación de base, no de UI) Con la sesión de la cuenta Usuario:
    ```ts
    // no puede crear pública
    await usuario.from("pets").insert({ id: crypto.randomUUID(), slug: "x", name: "x", visibility: "publico" })
    // esperado: error 42501

    // sí puede crear su propia privada
    const propiaId = crypto.randomUUID()
    await usuario.from("pets").insert({
      id: propiaId, slug: "y", name: "y", visibility: "privado", created_by: usuarioUid,
    })
    // esperado: éxito

    // no puede convertirla en pública
    await usuario.from("pets").update({ visibility: "publico" }).eq("id", propiaId)
    // esperado: 0 filas afectadas

    // no puede tocar una pública existente
    await usuario.from("pets").update({ name: "hackeado" }).eq("id", algunaPetIdPublica)
    // esperado: 0 filas afectadas

    // no puede tocar la privada de la cuenta admin de prueba
    await usuario.from("pets").delete().eq("id", petIdPrivadaDelAdmin)
    // esperado: 0 filas afectadas
    ```

## Escenario 2 — Historial visible solo para administradoras (User Story 2)

1. Con la cuenta Usuario del Escenario 1, crear un hito y marcar un
   avistamiento en una mascota.
2. Iniciar sesión con una cuenta admin y abrir la ficha de esa mascota —
   **esperado**: la sección "Historial" lista, en orden cronológico
   descendente, al menos: creación de la mascota (por quien la haya creado
   originalmente), el hito agregado y el avistamiento marcado, cada uno
   atribuido al nombre correcto.
3. Eliminar ese hito con la cuenta Usuario, volver a mirar el Historial con
   la cuenta admin — **esperado**: aparece un evento nuevo de eliminación,
   con el título del hito eliminado, aunque el hito ya no esté en la línea de
   tiempo.
4. Iniciar sesión con la cuenta Usuario (o sin sesión) y abrir la misma
   ficha — **esperado**: la sección Historial no aparece en absoluto.

## Escenario 3 — Solicitud pública y aprobación (User Story 3)

1. Sin sesión, ir a `/login` y completar el formulario de solicitud con un
   email de prueba nuevo (que no esté en `app_users`) — **esperado**: mensaje
   de confirmación, sin haber pasado por Google en ningún momento.
2. Intentar enviar una segunda solicitud con el mismo email antes de que se
   resuelva — **esperado**: rechazada (mensaje de "ya hay una solicitud
   pendiente con ese email").
3. Iniciar sesión con una cuenta admin y abrir `/admin/solicitudes` —
   **esperado**: la solicitud del paso 1 aparece listada, pendiente.
4. Aprobarla — **esperado**: pasa a "aprobada" en el panel; todavía no hay
   ninguna cuenta nueva en `app_users` (la aprobación sola no otorga acceso).
5. Iniciar sesión con Google usando ese mismo email — **esperado**: al volver
   de `/auth/callback`, la cuenta ya tiene rol Usuario (puede agregar hitos y
   marcar avistamientos, sin ningún paso adicional).
6. Repetir los pasos 1–3 con un segundo email de prueba, pero esta vez
   **rechazar** la solicitud — **esperado**: si esa persona inicia sesión con
   Google más adelante, no obtiene ningún rol (queda en la pantalla de "esta
   cuenta no tiene acceso").
7. Con la cuenta admin, en `/admin/solicitudes`, revocar el acceso de la
   cuenta creada en el paso 5 — **esperado**: esa cuenta desaparece de la
   lista de usuarios activos; su próximo intento de agregar un hito o marcar
   un avistamiento falla (RLS), aunque siga pudiendo iniciar sesión y navegar
   el registro público.
8. (Estado intermedio) Con una solicitud todavía pendiente, iniciar sesión
   con Google con ese email antes de que una admin la resuelva — **esperado**:
   mensaje explícito de "tu solicitud está pendiente", distinto del mensaje
   genérico de cuenta sin acceso.

## Escenario 4 — Verificación de RLS (checklist de CLAUDE.md)

```ts
// con un cliente anon, sin sesión:
await anon.from("app_users").select("*")
// esperado: [] — nadie sin sesión ve la lista de cuentas

await anon.from("account_requests").insert({ email: "a@b.com", display_name: "A" })
// esperado: éxito (es el camino público de solicitud)

await anon.from("account_requests").update({ status: "aprobada" }).eq("email", "a@b.com")
// esperado: 0 filas afectadas — anon no puede aprobar su propia solicitud

await anon.from("pet_activity_log").select("*")
// esperado: [] — nadie sin sesión admin ve el historial

// con sesión de una cuenta Usuario:
await usuarioClient.from("pet_activity_log").insert({ pet_id: algúnId, actor_label: "x", action: "mascota_creada" })
// esperado: error 42501 — ni siquiera una cuenta con permisos de escritura
// puede insertar a mano en el historial, solo los triggers pueden

// con sesión de la cuenta Usuario, subiendo una foto bajo el petId de una
// mascota pública existente que no es suya (o de la privada de otra cuenta):
await usuarioClient.storage.from("pet-photos").upload(`${petIdAjeno}/x.webp`, archivo)
// esperado: error de RLS — no puede escribir en la carpeta de una mascota
// que no es propia (research.md §9)
```

## Checklist final (CLAUDE.md)

- [ ] `npm run typecheck` pasa
- [ ] Un insert/update con la anon key sobre `app_users`, `account_requests`
      (fuera del insert público) o `pet_activity_log` falla o no tiene efecto
- [ ] Una cuenta Usuario no puede crear, editar ni eliminar mascotas, con o
      sin pasar por la interfaz
- [ ] El formulario de solicitud y el panel `/admin/solicitudes` funcionan en
      375px de ancho, con una sola mano
- [ ] No se agregaron variables de entorno nuevas
