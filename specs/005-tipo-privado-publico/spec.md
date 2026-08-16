# Feature Specification: Campo Tipo (Privado/Público) y visibilidad por administradora

**Feature Branch**: `005-tipo-privado-publico`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "vamos agregar nuevas funciones, quiero un campo de 'Tipo' con los valores Privado y Publico, agregar ese campo en los filtros y la funcionalidad que los publicos se muestran para todos los administradores y al publico pero los privados solo se muestran a la cuenta administradora que lo crea"

## Clarifications

### Session 2026-08-15

- Q: ¿Un registro Privado también queda oculto para el resto de las cuentas administradoras, o solo para el público sin sesión? → A: Oculto para todo el mundo excepto la cuenta que lo creó — ni el público ni otras administradoras lo ven, ni en la cuadrícula ni en su ficha.
- Q: ¿Cualquier administradora puede editar/borrar un registro Privado aunque no sea la creadora? → A: No. Solo la administradora dueña puede editarlo o borrarlo desde la app; el resto ni siquiera puede abrir su ficha. Los registros Públicos siguen editables por cualquier administradora, como hoy.
- Q: ¿Los hitos y avistamientos de un registro Privado se muestran igual que hoy (lectura pública total) o heredan la restricción? → A: Heredan la restricción — si no podés ver la ficha, tampoco podés ver su timeline de hitos ni su calendario de avistamientos.
- Q: ¿El Tipo se puede cambiar desde el formulario de alta/edición? → A: No, a propósito. El Tipo es de solo lectura desde la app; se establece corriendo SQL directo en Supabase, con el mismo criterio operativo que dar de alta una cuenta administradora en la tabla `admins`.
- Q: ¿El filtro de Tipo en el catálogo se muestra a cualquier visitante o solo a administradoras? → A: Solo cuando hay una sesión administradora activa — para un visitante sin sesión el filtro no tiene sentido, porque nunca ve privados ajenos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Un registro Privado queda invisible para todos salvo su creadora (Priority: P1)

Una administradora tiene, ya cargado directamente en la base, un registro marcado como Privado y asociado a su cuenta. Cuando ella navega el catálogo con su sesión activa, lo ve como cualquier otro. Cuando cualquier otra persona navega el catálogo — sea el público sin sesión, sea otra administradora logueada — ese registro no aparece en la cuadrícula, no aparece en el contador de resultados, y su ficha, si se accede directamente por URL, no carga.

**Why this priority**: Es la garantía central de la feature. Sin esto, "Privado" no significa nada — es el motivo por el que se pidió.

**Independent Test**: Con un registro Privado ya cargado (vía SQL) y asociado a la cuenta A, se prueba completamente: sesión de cuenta A lo ve; sin sesión no aparece; sesión de cuenta B (otra administradora) tampoco lo ve, ni en la cuadrícula ni accediendo directo a su URL.

**Acceptance Scenarios**:

1. **Given** un registro marcado Privado y asociado a la cuenta A, **When** la cuenta A navega el catálogo con sesión activa, **Then** el registro aparece en la cuadrícula igual que uno Público.
2. **Given** el mismo registro, **When** alguien navega el catálogo sin sesión, **Then** el registro no aparece en la cuadrícula ni se suma al contador total.
3. **Given** el mismo registro, **When** la cuenta B (otra administradora, no creadora) navega el catálogo con su propia sesión, **Then** el registro tampoco aparece.
4. **Given** el mismo registro, **When** alguien sin sesión o con la sesión de la cuenta B accede directamente a la URL de su ficha, **Then** no puede verla (la aplicación se comporta como si no existiera).
5. **Given** el mismo registro, **When** alguien sin sesión o con la sesión de la cuenta B intenta consultar sus hitos o su calendario de avistamientos, **Then** tampoco los obtiene.

---

### User Story 2 - Filtrar el catálogo por Tipo (Priority: P2)

Con sesión administradora activa, se abre el panel de Filtros del catálogo (el mismo que ya tiene Estado y Esterilizado) y aparece un grupo adicional "Tipo" con chips Privado/Público, para acotar rápido la vista a los registros propios marcados como privados o a los públicos.

**Why this priority**: Depende de que la restricción de visibilidad (User Story 1) ya exista para tener sentido, pero el catálogo sigue siendo funcional sin el filtro — es una comodidad, no la garantía.

**Independent Test**: Con sesión administradora activa y al menos un registro Privado propio y uno Público visibles, se prueba completamente abriendo el panel de Filtros, activando el chip "Privado" y viendo que la cuadrícula se acota, sin recargar la página.

**Acceptance Scenarios**:

1. **Given** una sesión sin administradora (público, sin sesión), **When** se abre el panel de Filtros, **Then** no aparece el grupo "Tipo" — solo Estado y Esterilizado, como hoy.
2. **Given** una sesión administradora activa, **When** se abre el panel de Filtros, **Then** aparece el grupo "Tipo" con chips Privado y Público, ninguno activo por defecto.
3. **Given** el panel de Filtros abierto con sesión administradora, **When** se activa el chip "Privado", **Then** la cuadrícula muestra solo los registros Privados visibles para esa cuenta (los propios) y el contador de resultados se actualiza.
4. **Given** chips de Tipo activos junto con chips de otros grupos (Estado, Esterilizado, Zona, búsqueda), **When** se combinan, **Then** se aplica AND entre grupos distintos, igual que ya ocurre entre Estado y Esterilizado.
5. **Given** el botón "Filtros", **When** hay un chip de Tipo activo, **Then** se suma al contador de filtros activos del botón.

---

### Edge Cases

- Una administradora edita un registro Público del que no es creadora (caso ya permitido hoy): puede seguir editándolo con normalidad; el campo Tipo no aparece como editable en ningún caso.
- Una administradora intenta editar o borrar, desde la app, un registro Privado ajeno cuya URL conoce de antemano: la operación se rechaza igual que si el registro no existiera.
- Todos los registros existentes al momento de introducir esta feature quedan como Público, sin intervención manual fila por fila.
- Un registro Privado cuya cuenta creadora fue eliminada de `admins`/`auth.users`: queda sin nadie que pueda verlo ni editarlo desde la app hasta que una administradora lo reasigne a mano en la base — comportamiento aceptado, no requiere manejo especial en la interfaz.

## Requirements *(mandatory)*

### Functional Requirements

**Dato**

- **FR-001**: El sistema MUST agregar a cada registro un atributo "Tipo" con exactamente dos valores posibles, Privado y Público, con valor por defecto Público tanto para registros nuevos como para los ya existentes al introducir esta feature.
- **FR-002**: El sistema MUST asociar cada registro Privado a exactamente una cuenta administradora (su creadora).
- **FR-003**: El sistema MUST NOT exponer ningún control en los formularios de alta o edición para cambiar el Tipo de un registro — es de solo lectura desde la aplicación.

**Visibilidad**

- **FR-004**: El sistema MUST mostrar todo registro Público en la cuadrícula, en su ficha, y en su timeline de hitos/avistamientos a cualquiera, con o sin sesión — mismo comportamiento que existe hoy para todos los registros.
- **FR-005**: El sistema MUST ocultar un registro Privado — en la cuadrícula, en el contador de resultados, en su ficha y en su timeline de hitos/avistamientos — a cualquier cuenta que no sea la administradora creadora, incluyendo al público sin sesión y a cualquier otra cuenta administradora.
- **FR-006**: El sistema MUST mostrar un registro Privado, en todos esos mismos lugares, a la cuenta administradora que lo creó, exactamente igual que si fuera Público.
- **FR-007**: El sistema MUST garantizar la restricción de FR-005/FR-006 mediante política de la base de datos (RLS), no mediante un chequeo que dependa únicamente del código de la aplicación — un intento de lectura directo (sin pasar por la interfaz) con una cuenta que no es la creadora también debe fallar.

**Edición**

- **FR-008**: El sistema MUST permitir que cualquier cuenta administradora edite o borre un registro Público, igual que hoy.
- **FR-009**: El sistema MUST permitir editar o borrar un registro Privado únicamente a la cuenta administradora creadora; para cualquier otra cuenta (incluidas otras administradoras) la operación MUST fallar exactamente igual que si el registro no existiera.

**Filtros**

- **FR-010**: El sistema MUST agregar, dentro del panel de Filtros del catálogo, un grupo "Tipo" con chips Privado y Público, siguiendo el mismo patrón de selección múltiple (OR dentro del grupo) y combinación con los demás filtros (AND entre grupos) que ya existe para Estado y Esterilizado.
- **FR-011**: El sistema MUST mostrar el grupo de filtro "Tipo" únicamente cuando hay una sesión administradora activa; MUST NOT mostrarlo a un visitante sin sesión.
- **FR-012**: El sistema MUST actualizar la cuadrícula y el contador de resultados sin recargar la página al activar o desactivar un chip de Tipo, y MUST sumarlo al contador de filtros activos del botón "Filtros".

**Indicador visual**

- **FR-013**: El sistema MUST mostrar un indicador visual en la tarjeta de la cuadrícula únicamente cuando el registro es Privado (visible, por definición, solo para su creadora); el caso Público no ocupa espacio visual adicional — mismo criterio que el indicador de Esterilizado.

### Key Entities *(include if feature involves data)*

- **Mascota** *(ya existe)*: suma dos atributos — Tipo (Privado/Público, no nulo, default Público) y la cuenta administradora creadora (solo aplica su restricción cuando el Tipo es Privado) — a los ya definidos en `001-catalogo-publico` y editables desde `002-panel-administracion`.
- **Hito** y **Avistamiento** *(ya existen)*: no suman atributos propios, pero su visibilidad pasa a depender del Tipo y la creadora de la mascota a la que pertenecen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los registros — nuevos y ya existentes al introducir esta feature — tienen un Tipo explícito (Privado o Público), nunca nulo o indefinido.
- **SC-002**: El 100% de los intentos de lectura, edición o borrado de un registro Privado realizados por una cuenta distinta de la creadora (con o sin sesión administradora, incluso sin pasar por la interfaz) son rechazados por la base de datos.
- **SC-003**: Una cuenta administradora puede acotar la cuadrícula a sus propios registros Privados o a los Públicos usando el filtro de Tipo, ver el resultado actualizado, y volver al listado completo, todo sin recargar la página.
- **SC-004**: Un visitante sin sesión nunca ve, en ningún punto de la interfaz (cuadrícula, contador, ficha directa por URL, panel de filtros), evidencia de que existe un registro Privado ajeno.

## Assumptions

- Esta feature extiende `004-esterilizado-y-filtros` (mismo patrón de columna + filtro de chips) y toca el modelo de permisos definido en `002-panel-administracion` (RLS, cuentas administradoras sin jerarquía entre sí).
- No se agrega ningún control de interfaz para crear un registro Privado ni para cambiar el Tipo de uno existente: eso se resuelve operando directo sobre la base, con el mismo criterio ya usado para dar de alta cuentas administradoras en la tabla `admins`. Confirmado explícitamente con el usuario.
- Cuando una administradora deja de existir como cuenta administradora, sus registros Privados quedan sin nadie que los vea ni edite desde la app hasta que se reasignen a mano en la base — se acepta como comportamiento válido, no requiere una pantalla de "reasignar dueño".
- El filtrado por Tipo se resuelve del lado del cliente sobre los datos que la cuadrícula ya recibió (mismo criterio que Zona, Estado y Esterilizado) — la restricción real de qué registros llegan al cliente para empezar es responsabilidad de la política de base de datos (RLS), no del filtro.
- No se agrega un tercer valor de Tipo ni niveles de privacidad intermedios (por ejemplo, "visible para un subconjunto de administradoras") — fuera de alcance de esta feature.
