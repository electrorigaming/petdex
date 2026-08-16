# Quickstart: validar Campo Tipo (Privado/Público)

## Prerrequisitos

- Migración aplicada: `supabase db push` (con tu login) usando la migración
  nueva de esta feature (ver plan.md — carpeta `supabase/migrations/`).
- Verificar que `pets_overview` corre con los privilegios de quien consulta
  (si esto falla, las mascotas privadas se filtran a la cuadrícula pública
  sin que ningún otro test lo detecte — research.md §2):
  ```sql
  select reloptions from pg_class where relname = 'pets_overview';
  -- esperado: {security_invoker=on}
  ```
  Ya cubierto por el `alter view ... set (security_invoker = on)` explícito
  al final de la migración (se aplica sin importar el estado previo, así que
  no puede quedar desactivado) y confirmado indirectamente en T010: con
  sesión cerrada, una mascota privada de prueba desapareció por completo de
  la cuadrícula — el síntoma exacto que esta consulta previene. Correrla
  manualmente es opcional en adelante, no bloqueante.
- Tipos regenerados y verificados:
  ```bash
  npm run gen:types
  npm run typecheck
  ```
- Una cuenta administradora de prueba con sesión iniciada.
- Una mascota marcada a mano como privada, vía SQL Editor de Supabase, con
  `created_by` apuntando al `user_id` de esa cuenta:
  ```sql
  update public.pets
  set visibility = 'privado', created_by = '<uuid-de-tu-cuenta-admin>'
  where slug = '<slug-de-prueba>';
  ```
- Al menos una segunda mascota que quede `publico` (el default), para poder
  comparar.

## Escenario 1 — Visibilidad de un registro Privado (User Story 1)

1. Con sesión de la cuenta dueña (`created_by`), abrir `/` — **esperado**: la
   mascota privada aparece en la cuadrícula igual que cualquier otra, y su
   ficha (`/mascotas/{slug}`) carga con normalidad, incluidos sus hitos y su
   calendario de avistamientos.
2. Cerrar sesión (o ventana privada) y abrir `/` — **esperado**: la mascota
   no aparece en la cuadrícula ni se suma al contador total.
3. Sin sesión, navegar directo a `/mascotas/{slug}` — **esperado**: página
   no encontrada (`notFound()`), igual que un slug inexistente.
4. Iniciar sesión con **otra** cuenta administradora (no la dueña) y repetir
   los pasos 2 y 3 — **esperado**: mismo resultado que sin sesión, la
   mascota sigue invisible.

## Escenario 2 — Edición restringida a la dueña (User Story 1)

1. Con sesión de la cuenta dueña, editar la mascota privada — **esperado**:
   funciona con normalidad, igual que cualquier mascota pública.
2. Con sesión de otra cuenta administradora, intentar acceder a
   `/mascotas/{slug}/editar` — **esperado**: falla igual que si la mascota
   no existiera (la lectura previa a mostrar el formulario ya la oculta).
3. (Verificación de base, no de UI) Con sesión de una admin que **no** es la
   dueña de una mascota pública, intentar vía cliente Supabase
   `update pets set visibility='privado', created_by='<su-uuid>' where
   id=<mascota-pública-ajena>` — **esperado**: falla (rechazado por
   `pets_lock_visibility_trigger`, research.md §3.1). Sin este trigger, esa
   misma sentencia pasaría las políticas de `update` y le robaría la mascota
   pública a su dueña original.

## Escenario 3 — Filtro de Tipo en el catálogo (User Story 2)

1. Sin sesión, tocar el botón "Filtros" en `/` — **esperado**: se ven los
   grupos Estado y Esterilizado, **sin** el grupo Tipo (FR-011).
2. Iniciar sesión con la cuenta dueña de la mascota privada y volver a tocar
   "Filtros" — **esperado**: ahora aparece también el grupo Tipo, con chips
   Privado/Público, ninguno activo.
3. Activar el chip "Privado" — **esperado**: la cuadrícula se acota a las
   mascotas privadas visibles para esa cuenta (las propias) y el contador de
   resultados se actualiza sin recargar la página.
4. Combinar con un chip de Estado — **esperado**: AND entre grupos, igual
   que la combinación Estado/Esterilizado ya existente.
5. Verificar el botón "Filtros" — **esperado**: el chip de Tipo activo suma
   al contador total.

## Escenario 4 — Indicador visual (User Story 1 / FR-013)

1. Con sesión de la cuenta dueña, ubicar la tarjeta de la mascota privada en
   `/` — **esperado**: muestra el indicador "Privado".
2. Ubicar una tarjeta pública — **esperado**: sin indicador, sin espacio
   visual adicional (mismo criterio que el badge de Esterilizado).

## Escenario 5 — Verificación de RLS (checklist de CLAUDE.md)

```ts
// con un cliente anon, sin sesión, contra el id de la mascota privada:
await anon.from("pets").select("*").eq("id", petPrivadoId)
// esperado: [] (cero filas — la política pets_select la oculta)

await anon.from("pets").update({ name: "hackeado" }).eq("id", petPrivadoId)
// esperado: 0 filas afectadas

// con sesión de una admin que NO es la dueña:
await otraAdmin.from("pets").delete().eq("id", petPrivadoId)
// esperado: 0 filas afectadas — cubierto por
// tests/integration/rls-pets-visibility.test.ts (research.md §5, sin
// necesitar una segunda cuenta de Google real)
```

## Checklist final (CLAUDE.md)

- [ ] `npm run typecheck` pasa
- [ ] Un insert/select/update con la anon key sobre una mascota privada no
      tiene efecto ni devuelve datos
- [ ] Una sesión administradora que no es la dueña tampoco ve ni puede
      editar la mascota privada
- [ ] La pantalla de filtros funciona en 375px de ancho, con una sola mano
- [ ] No se agregaron variables de entorno nuevas
