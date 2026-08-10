# Quickstart: Catálogo público

Guía para validar la feature de punta a punta una vez implementada. No
sustituye a `tasks.md` (que no existe todavía — lo genera `/speckit-tasks`).

## Prerrequisitos

- `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  del proyecto ya linkeado (`owfxiyhqnkuquagsxbid`).
- El esquema de `petdex-schema.sql` ya aplicado en ese proyecto (asumido —
  esta feature no lo vuelve a aplicar).
- Al menos una fila de prueba en `pets` con foto, zona, y algún campo opcional
  vacío; al menos una fila en `milestones` para esa mascota; y una mascota
  adicional sin ninguna foto ni hitos, para poder ejercitar los casos borde.

## Setup

```bash
npm install
npm run gen:types   # confirma que src/types/database.ts sigue sincronizado
npm run dev
```

## Validación — Pantalla A (`/`)

1. Abrir `/` → el contador coincide con la cantidad real de filas en `pets`
   (Principio "Cuadrícula", SC-001).
2. Confirmar que cada mascota con foto la muestra, y la que no tiene foto
   muestra el placeholder — nunca un ícono de imagen rota (SC-002).
3. Tocar el alternador de vista → cambia a lista compacta; recargar la
   página → sigue en lista (SC-006, sin flash del layout de cuadrícula antes
   de aplicar la preferencia).
4. Escribir en el buscador el nombre de una mascota con mayúsculas y sin
   acentos distintos a como está guardado → aparece igual (SC-003).
5. Borrar el buscador y elegir una zona en el filtro → solo quedan mascotas
   de esa zona.
6. Escribir un texto que no matchea nada → aparece el estado "sin
   resultados", visualmente distinto al estado vacío (SC-007).
7. (Solo si se puede vaciar la tabla en un entorno de prueba) Con `pets`
   vacía, `/` muestra el estado vacío general, no "sin resultados".

## Validación — Pantalla B (`/mascotas/[slug]`)

1. Entrar a la ficha de una mascota con todos los campos opcionales
   cargados → se ven foto grande, apodos, zona, ubicación, fecha de
   registro, edad estimada, peso y descripción.
2. Entrar a la ficha de una mascota con campos opcionales vacíos → esos
   campos no aparecen en absoluto, ni como "sin datos" (SC-004).
3. Entrar a la ficha de una mascota con varios hitos → aparecen del más
   reciente al más antiguo; tocar el control de orden → se invierte.
4. Entrar a la ficha de una mascota sin hitos → la línea de tiempo se ve
   vacía sin error.
5. Visitar `/mascotas/no-existe-este-slug` → aparece el 404 propio de
   PetDex, no la página de error genérica de Next (SC-005).

## Validación — RLS (no solo un test automatizado, también a mano)

```bash
npm run test -- rls-pets-insert
```

Y, para confirmar manualmente lo que dice el checklist de "tarea terminada"
de `CLAUDE.md`: con la anon key, un `insert` directo en `pets` desde la
consola de Supabase (rol `anon`) o desde un script suelto debe fallar. Si no
falla, no seguir construyendo encima — la política RLS está mal.

## Validación — mobile-first

Con las devtools en 375px de ancho: el buscador, el filtro de zona y el
alternador de vista son alcanzables y operables con una sola mano (sin
gestos de pinch-zoom ni scroll horizontal).

## Checks automatizados

```bash
npm run typecheck
npm run test
```
