# Quickstart: validar Campo Esterilizado y filtros de Estado/Esterilizado

## Prerrequisitos

- Migración aplicada: `supabase db push` (con tu login) usando
  `supabase/migrations/20260814120000_add_sterilized_to_pets.sql`.
- Tipos regenerados y verificados:
  ```bash
  npm run gen:types
  npm run typecheck
  ```
- Al menos dos mascotas ya cargadas con `status` y `sterilized` distintos
  entre sí (para poder ver el filtro combinando resultados).
- `npm run dev` corriendo, con sesión de administradora iniciada para la
  parte de alta/edición.

## Escenario 1 — Cargar y ver el dato (User Story 1)

1. Editar una mascota existente (`/mascotas/{slug}/editar`), marcar
   "Esterilizado: Sí", guardar.
2. **Esperado**: la ficha pública (`/mascotas/{slug}`) muestra el badge
   "Esterilizada" junto al de Estado.
3. Repetir marcando "No" — **esperado**: el badge deja de aparecer en la
   ficha (o refleja "No", según el tratamiento final de `pet-detail.tsx`).
4. Sin sesión (ventana privada o cerrar sesión), abrir la misma ficha —
   **esperado**: el dato se ve igual, sin controles de edición.

## Escenario 2 — Tarjeta de la cuadrícula (User Story 1)

1. En `/`, ubicar una mascota marcada como esterilizada.
2. **Esperado**: su tarjeta muestra el indicador correspondiente, tanto en
   vista grid como en vista lista (`<ViewToggle>`).
3. Ubicar una mascota no esterilizada — **esperado**: su tarjeta no muestra
   ningún indicador de esterilización (FR-004).

## Escenario 3 — Filtros combinados (User Story 2)

1. En `/`, tocar el botón "Filtros".
2. **Esperado**: se despliegan los chips de Estado (4) y Esterilizado (2),
   ninguno activo.
3. Activar "Activo" — **esperado**: la cuadrícula y el contador se
   actualizan a solo mascotas con `status = "activo"`, sin recargar la
   página.
4. Activar también "Sin ver" (mismo grupo) — **esperado**: la cuadrícula
   ahora muestra "activo" **o** "sin ver" (OR intra-grupo).
5. Activar "Esterilizado" (otro grupo) — **esperado**: la cuadrícula se
   acota a mascotas que además cumplen `sterilized = true` (AND
   entre-grupos, FR-007).
6. Verificar el botón "Filtros" — **esperado**: muestra el contador de
   filtros activos (3 en este punto: Activo, Sin ver, Esterilizado).
7. Ajustar la combinación hasta llegar a cero resultados — **esperado**: se
   ve el mismo estado vacío "sin resultados" ya existente, con una acción
   que limpia zona, búsqueda, estado y esterilizado de una sola vez (FR-011).

## Escenario 4 — Verificación de RLS (checklist de CLAUDE.md)

```ts
// con un cliente anon, sin sesión:
await anon.from("pets").update({ sterilized: true }).eq("id", petIdExistente)
// esperado: 0 filas afectadas (misma semántica que el resto de los campos,
// cubierto por tests/integration/rls-pets-write.test.ts sin cambios)
```

## Checklist final (CLAUDE.md)

- [ ] `npm run typecheck` pasa
- [ ] Un insert/update con la anon key sobre `pets.sterilized` no tiene efecto
- [ ] La pantalla de filtros funciona en 375px de ancho, con una sola mano
- [ ] No se agregaron variables de entorno nuevas
