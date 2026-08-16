# Quickstart: validar Tipo editable desde el formulario

## Prerrequisitos

- Migración aplicada (SQL Editor de Supabase, ver plan.md) y
  `npm run gen:types && npm run typecheck` en verde.
- Al menos dos cuentas administradoras reales para poder probar el
  Escenario 3 (la cobertura automatizada del caso "B se apropia de la
  pública de A" es lógica, no con una segunda sesión real — research.md
  §7). Si solo tenés una cuenta de prueba, salteá ese escenario.

## Escenario 1 — Crear una mascota Privada (User Story 1)

1. Con sesión admin, ir a `/mascotas/nueva`, completar los datos, dejar
   Tipo en "Público" (default) y guardar.
2. **Esperado**: aparece en la cuadrícula para cualquiera, sin sesión.
3. Crear otra mascota, esta vez marcando Tipo = "Privado", guardar.
4. **Esperado**: redirige a su ficha con normalidad (sos la dueña). Cerrar
   sesión y volver a `/` — **esperado**: esa mascota no aparece ni suma al
   contador.

## Escenario 2 — Volver una ficha de Privada a Pública (Acceptance Scenario 3)

1. Con la sesión dueña de la mascota Privada del Escenario 1, ir a su
   edición, cambiar Tipo a "Público", guardar.
2. **Esperado**: sin sesión, la mascota vuelve a aparecer en la cuadrícula.

## Escenario 3 — Otra admin toma una ficha pública (Acceptance Scenario 4, necesita 2 cuentas)

1. Con la cuenta A, crear una mascota Pública.
2. Con la cuenta B (otra admin), editar esa misma mascota y marcarla
   "Privado", guardar.
3. **Esperado**: la ficha queda visible solo para B. La cuenta A, al volver
   a `/`, ya no la ve ni puede acceder a su edición (falla igual que si no
   existiera).

## Escenario 4 — Verificación de RLS (checklist de CLAUDE.md)

```ts
// con sesión admin, sobre una fila pública propia:
await admin.from("pets")
  .update({ visibility: "privado", created_by: null })
  .eq("id", petId)
// esperado: error 42501 ("new row violates row-level security policy"),
// data null — pets_admin_update rechaza dejar la fila en privado con un
// created_by que no es el de quien ejecuta (FR-006). Un UUID inventado en
// vez de null fallaría antes por la FK a auth.users, no por RLS — no sirve
// para esta prueba (research.md §7).
```

## Checklist final (CLAUDE.md)

- [ ] `npm run typecheck` pasa
- [ ] Un update con la anon key sobre `visibility`/`created_by` no tiene
      efecto
- [ ] El formulario funciona en 375px de ancho
- [ ] No se agregaron variables de entorno nuevas
