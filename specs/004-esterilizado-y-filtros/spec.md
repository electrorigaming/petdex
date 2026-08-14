# Feature Specification: Campo Esterilizado y filtros de Estado/Esterilizado

**Feature Branch**: `004-esterilizado-y-filtros`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Agregar un campo 'Esterilizado' a la información de mascotas. Colocar en el dashboard principal badges de filtros de Estado y Esterilizado."

## Clarifications

### Session 2026-08-14

- Q: ¿Cuántos valores puede tener el campo Esterilizado? → A: Booleano (Sí / No), no un tercer estado "sin dato" — a diferencia del criterio de tres estados usado para avistamientos, acá se asume que la administradora siempre puede determinarlo al cargar la mascota.
- Q: ¿Cuál es el valor por defecto? → A: No — tanto para mascotas nuevas como para las ya existentes en la base al aplicar la migración.
- Q: ¿Cómo funcionan los badges de filtro de Estado y Esterilizado? → A: Chips tipo toggle, selección múltiple dentro de cada grupo (se puede filtrar por "Activo" + "Sin ver" a la vez, o por "Esterilizado" solo). Ningún chip activo en un grupo equivale a no filtrar por ese campo.
- Q: ¿Esterilizado se muestra en la tarjeta de la cuadrícula, o solo en la ficha? → A: En ambas. En la ficha se muestra siempre (Sí/No, igual criterio que Estado). En la tarjeta solo se marca cuando es "Sí" — el caso "No" no ocupa espacio visual, mismo criterio que el badge "Hoy/Ayer" de avistamientos.
- Q: ¿Cómo se organizan los filtros nuevos en una pantalla de 375px pensada para uso con una mano? → A: Un botón "Filtros" (con contador de filtros activos) junto al selector de Zona, que expande/colapsa un panel con los chips de Estado y Esterilizado. La pantalla inicial queda tan despejada como hoy.
- Q: El esquema no tiene migraciones versionadas en el repo — ¿cómo se aplica el `ALTER TABLE`? → A: Se agrega el primer archivo de migración versionado en `supabase/migrations/`; el usuario lo aplica con `supabase db push` con su propio login (nunca con la service role key).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar si una mascota está esterilizada (Priority: P1)

Con sesión activa, la administradora carga o edita una mascota e indica si
está esterilizada (Sí/No), con el mismo tipo de control que ya usa para
"Estado". El dato queda visible en la ficha pública de la mascota para
cualquier visitante, con o sin sesión.

**Why this priority**: Es el dato base — sin poder cargarlo, no hay nada que
mostrar ni que filtrar.

**Independent Test**: Con sesión activa, se puede probar completamente
editando una mascota existente, marcándola como esterilizada, guardando, y
viendo el badge correspondiente en su ficha pública sin necesitar sesión.

**Acceptance Scenarios**:

1. **Given** el formulario de alta de una mascota nueva, **When** la
   administradora no toca el campo Esterilizado, **Then** se guarda como "No"
   por defecto.
2. **Given** el formulario de alta o edición, **When** la administradora
   marca "Sí" en Esterilizado y guarda, **Then** la ficha pública de esa
   mascota muestra el badge "Esterilizada".
3. **Given** una mascota marcada como esterilizada, **When** la
   administradora la edita y cambia el valor a "No", **Then** la ficha
   pública deja de mostrar ese badge y refleja "No" para quien consulte el
   dato en la cuadrícula filtrando por Esterilizado.
4. **Given** una mascota cargada en la base antes de esta feature, **When**
   se consulta su ficha después de aplicada la migración, **Then** muestra
   "No esterilizada" (default aplicado a filas existentes), nunca un estado
   vacío o "sin dato".

---

### User Story 2 - Filtrar el catálogo por Estado y Esterilizado (Priority: P2)

Cualquier visitante, sin necesitar sesión, abre el panel de filtros del
catálogo público y activa uno o más chips dentro de "Estado" y/o
"Esterilizado" para acotar la cuadrícula a las mascotas que le interesan
(por ejemplo, "Activo" + "Sin ver", o solo "Esterilizado").

**Why this priority**: Depende de que exista el dato (User Story 1) para
tener sentido, y es el motivo explícito por el que se pidió esta feature,
pero el catálogo sigue siendo completamente funcional sin ella.

**Independent Test**: Con al menos dos mascotas con estados y valores de
Esterilizado distintos ya cargadas, se puede probar completamente abriendo
el panel de Filtros, activando combinaciones de chips, y viendo que la
cuadrícula y el contador se actualizan sin recargar la página.

**Acceptance Scenarios**:

1. **Given** el catálogo con el panel de Filtros cerrado, **When** el
   visitante lo abre, **Then** ve los chips de Estado (Activo / Sin ver /
   Adoptado / Fallecido) y de Esterilizado (Esterilizado / No esterilizado),
   ninguno activo por defecto.
2. **Given** el panel de Filtros abierto, **When** el visitante activa un
   chip de Estado, **Then** la cuadrícula muestra solo mascotas con ese
   estado y el contador de resultados se actualiza.
3. **Given** un chip de Estado ya activo, **When** el visitante activa un
   segundo chip del mismo grupo, **Then** la cuadrícula muestra las mascotas
   que matchean cualquiera de los dos (OR dentro del grupo).
4. **Given** chips activos tanto en Estado como en Esterilizado, **When** se
   combinan, **Then** la cuadrícula muestra solo mascotas que matchean al
   menos un chip activo de Estado Y al menos un chip activo de Esterilizado
   (AND entre grupos), además de respetar el filtro de Zona y la búsqueda por
   nombre ya existentes.
5. **Given** cualquier combinación de filtros activa, **When** el visitante
   la deja sin resultados, **Then** ve el mismo estado vacío "sin resultados"
   que ya existe para la búsqueda por nombre, con una opción que limpia todos
   los filtros (zona, búsqueda, estado y esterilizado) de una vez.
6. **Given** el botón "Filtros", **When** hay al menos un chip activo,
   **Then** el botón muestra un contador con la cantidad de filtros activos.

---

### Edge Cases

- Una mascota con estado "Fallecido" y sin marcar "Esterilizado": sigue
  apareciendo en el catálogo salvo que el visitante filtre explícitamente
  por Estado o Esterilizado — el catálogo no oculta nada por defecto.
- Todos los chips de un mismo grupo activos a la vez: equivale a no filtrar
  por ese grupo (mismo resultado que ninguno activo), no a una intersección
  vacía.
- La migración se aplica sobre una base con mascotas ya cargadas: todas
  quedan en "No esterilizado" sin intervención manual fila por fila.

## Requirements *(mandatory)*

### Functional Requirements

**Dato**

- **FR-001**: El sistema MUST agregar a cada mascota un atributo booleano
  "esterilizado", con valor por defecto "No" tanto para mascotas nuevas como
  para las ya existentes al momento de aplicar la migración.
- **FR-002**: El sistema MUST permitir a una administradora con sesión activa
  editar el valor de "esterilizado" desde el mismo formulario de alta/edición
  que ya usa para el resto de los datos de la mascota.
- **FR-003**: El sistema MUST mostrar el valor de "esterilizado" en la ficha
  pública de la mascota (Sí/No, siempre visible) a cualquier visitante, con o
  sin sesión.
- **FR-004**: El sistema MUST mostrar un indicador en la tarjeta de la
  cuadrícula (grid y lista) únicamente cuando la mascota está marcada como
  esterilizada; el caso "No" no se marca en la tarjeta.

**Filtros**

- **FR-005**: El sistema MUST proveer, en el catálogo público, un control que
  expande y colapsa un panel de filtros con chips de Estado (Activo / Sin ver
  / Adoptado / Fallecido) y de Esterilizado (Esterilizado / No esterilizado).
- **FR-006**: El sistema MUST permitir activar más de un chip dentro de un
  mismo grupo (Estado o Esterilizado), combinándolos con OR dentro del grupo.
- **FR-007**: El sistema MUST combinar los filtros de Estado y Esterilizado
  entre sí, y con los filtros de Zona y búsqueda por nombre ya existentes,
  con AND entre grupos distintos.
- **FR-008**: El sistema MUST tratar "ningún chip activo en un grupo" como
  equivalente a "sin filtrar por ese grupo", nunca como "sin resultados".
- **FR-009**: El sistema MUST actualizar la cuadrícula y el contador de
  resultados sin recargar la página al activar o desactivar un chip.
- **FR-010**: El sistema MUST mostrar en el control que abre el panel de
  filtros la cantidad de filtros actualmente activos.
- **FR-011**: El sistema MUST permitir limpiar de una sola acción todos los
  filtros activos (zona, búsqueda, estado, esterilizado) cuando una
  combinación no arroja resultados.

**Transversales**

- **FR-012**: El sistema MUST garantizar mediante política de la base de
  datos (RLS), no solo ocultando controles, que ninguna escritura del campo
  "esterilizado" se complete sin una sesión administradora válida.

### Key Entities *(include if feature involves data)*

- **Mascota** *(ya existe)*: suma el atributo `sterilized` (booleano, no
  nulo, default `false`) a los ya definidos en `001-catalogo-publico` y
  editables desde `002-panel-administracion`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las mascotas — nuevas y ya existentes al aplicar la
  migración — tienen un valor explícito (Sí/No) para "esterilizado", nunca
  nulo o indefinido.
- **SC-002**: Un visitante puede acotar la cuadrícula a un subconjunto por
  Estado y/o Esterilizado, ver el resultado actualizado, y volver al listado
  completo limpiando los filtros, todo sin recargar la página.
- **SC-003**: El 100% de los intentos de escritura sobre el campo
  "esterilizado" realizados sin una sesión administradora válida son
  rechazados por la base de datos, incluso invocados sin pasar por la
  interfaz.

## Assumptions

- Este feature amplía lo definido en `002-panel-administracion` (FR-026):
  ahí "estado" quedaba como dato puramente informativo y el catálogo público
  no lo usaba para filtrar. Acá se agrega un filtro por Estado *explícito y
  a pedido del visitante* — el catálogo sigue sin ocultar nada por defecto,
  pero ahora permite acotar la vista manualmente. No se reabre ninguna otra
  decisión de esa feature.
- No se agrega una fecha de esterilización ni un tercer estado "sin dato":
  confirmado con el usuario, el campo es estrictamente booleano.
- El filtrado de Estado y Esterilizado se resuelve 100% en el cliente sobre
  los datos que ya trae `pets_overview` para la cuadrícula — mismo criterio
  ya usado para el filtro de Zona en `001-catalogo-publico` (sin presupuesto
  para paginar ni para consultas adicionales).
- No se agrega gestión de "categorías" de esterilización (por ejemplo,
  campaña o veterinaria que la realizó) — fuera de alcance de esta feature.
