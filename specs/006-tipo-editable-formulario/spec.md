# Feature Specification: Tipo editable desde el formulario

**Feature Branch**: `006-tipo-editable-formulario`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "como agrego una mascota privada? en el formulario de agregaar no aparece el campo?, deberia de aparecer"

## Relación con 005-tipo-privado-publico

Esta feature **revierte una decisión explícita** de `005-tipo-privado-publico`:
ahí se definió que el campo Tipo era de solo lectura desde la app (FR-003 de
esa spec) y solo se podía cambiar corriendo SQL directo en Supabase. Después
de usarlo, se decidió que sí tiene que poder cargarse/cambiarse desde el
formulario de alta/edición. **FR-003 de `005-tipo-privado-publico` queda
derogado por esta spec.** El resto de `005` (la garantía de visibilidad vía
RLS, el filtro de Tipo en el catálogo, el indicador visual en la tarjeta)
sigue vigente sin cambios.

## Clarifications

### Session 2026-08-16

- Q: Cuando una admin que NO es la dueña edita una ficha pública y la pasa a
  Privada desde el formulario, ¿quién queda como dueña? → A: Quien hace el
  cambio — `created_by` pasa a ser la cuenta que acaba de guardar, sin
  importar quién la creó originalmente. "Privado" significa "visible para
  quien la marcó así por última vez", nunca un candado que excluye a quien
  la acaba de editar.
- Q: ¿Se puede volver una ficha de Privada a Pública desde el mismo
  formulario? → A: Sí, de forma simétrica — sin restricción adicional más
  allá de que quien edita ya tenga permiso para editar esa ficha (o sea, ser
  la dueña, si hoy es privada).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Marcar una mascota como Privada al cargarla o editarla (Priority: P1)

Con sesión administradora activa, al completar el formulario de alta (o
editar una ficha ya existente que se puede editar), la administradora
elige el Tipo (Público o Privado) con el mismo tipo de control que ya usa
para Estado y Esterilizado. Al guardar, esa elección se aplica de
inmediato: si eligió Privado, la ficha queda visible únicamente para su
propia cuenta a partir de ese momento.

**Why this priority**: Es el motivo por el que se pidió esta feature — hoy
no hay ninguna forma de crear o marcar una mascota como privada sin salir de
la aplicación, lo cual contradice la expectativa razonable de que un campo
del dato tenga un lugar en el formulario que lo carga.

**Independent Test**: Con sesión activa, se puede probar completamente
creando una mascota nueva marcada como Privada, guardando, y confirmando que
desaparece de la cuadrícula al cerrar sesión (o con otra cuenta), y que
sigue visible con la sesión que la creó.

**Acceptance Scenarios**:

1. **Given** el formulario de alta de una mascota nueva, **When** la
   administradora no toca el campo Tipo, **Then** se guarda como "Público"
   por defecto (mismo comportamiento que hoy).
2. **Given** el formulario de alta, **When** la administradora marca "Privado"
   y guarda, **Then** la ficha queda visible únicamente para su cuenta —
   nadie más la ve en la cuadrícula, ni en su ficha, ni en su timeline.
3. **Given** una ficha propia marcada como Privada, **When** la
   administradora dueña la edita y la vuelve a marcar "Público", **Then** la
   ficha vuelve a ser visible para cualquiera, con o sin sesión.
4. **Given** una ficha Pública creada por la cuenta A, **When** la cuenta B
   (otra administradora) la edita y la marca "Privado", **Then** la ficha
   queda visible únicamente para la cuenta B a partir de ese guardado — ni
   siquiera la cuenta A (su creadora original) puede seguir viéndola o
   editándola.
5. **Given** una ficha ya Privada de la cuenta A, **When** la cuenta B (no
   dueña) intenta acceder a su edición, **Then** la operación se rechaza
   exactamente igual que si la ficha no existiera (ya vigente desde
   `005-tipo-privado-publico`, sin cambios).

### Edge Cases

- Editar una ficha Pública y guardarla sin tocar el campo Tipo: no cambia de
  dueña ni de visibilidad — solo cambia de dueña cuando el valor guardado es
  explícitamente "Privado".
- Dos administradoras no pueden "pelear" por la misma ficha al mismo tiempo:
  gana quien guarda último, igual que con cualquier otro campo del
  formulario — no es un caso especial de Tipo.
- Si la administradora dueña de una ficha Privada deja de existir como
  cuenta administradora, la ficha queda sin nadie que la vea ni edite desde
  la app hasta que otra administradora la reclame creando una ficha nueva o
  hasta una intervención manual — comportamiento ya aceptado en
  `005-tipo-privado-publico`, sin cambios.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar, en el formulario de alta y edición de
  una mascota, un control para elegir su Tipo (Público o Privado), con el
  mismo patrón de control que ya usan Estado y Esterilizado.
- **FR-002**: El sistema MUST usar "Público" como valor por defecto del
  campo Tipo al abrir el formulario de alta de una mascota nueva.
- **FR-003**: El sistema MUST permitir guardar el formulario con el Tipo
  elegido, tanto al crear una mascota nueva como al editar una ya existente,
  a cualquier cuenta administradora que ya tenga permiso para editar esa
  ficha según las reglas vigentes (cualquiera si es Pública hoy; solo la
  dueña si ya es Privada hoy).
- **FR-004**: El sistema MUST asignar como dueña de una ficha, en cualquier
  guardado cuyo resultado sea Tipo = Privado, exactamente a la cuenta que
  realizó ese guardado — sin importar quién era la dueña antes o quién creó
  la ficha originalmente.
- **FR-005**: El sistema MUST permitir volver una ficha de Privada a Pública
  desde el mismo formulario, sin ningún requisito adicional más allá del
  permiso de edición ya vigente.
- **FR-006**: El sistema MUST garantizar mediante política de la base de
  datos (RLS), no mediante lógica de la aplicación, que ninguna cuenta
  pueda guardar una ficha en Privado asignándose como dueña a sí misma sin
  ser realmente la cuenta autenticada que hace la operación, y que ninguna
  cuenta pueda editar el Tipo de una ficha que no tiene permiso de editar.
- **FR-007**: El sistema MUST mantener sin cambios el resto del
  comportamiento ya definido en `005-tipo-privado-publico`: el indicador
  visual "Privado" en la tarjeta de la cuadrícula, el filtro de Tipo en el
  catálogo (visible solo con sesión administradora), y la herencia de la
  restricción de visibilidad en hitos y avistamientos.

### Key Entities *(include if feature involves data)*

- **Mascota** *(ya existe, `001-catalogo-publico`)*: sus atributos `Tipo`
  (Público/Privado) y `dueña` (solo aplica cuando Tipo=Privado), agregados
  en `005-tipo-privado-publico`, pasan de ser de solo lectura desde la app a
  ser editables desde el formulario de alta/edición.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una administradora puede crear o convertir una mascota en
  Privada completando el formulario que ya usa para el resto de los datos,
  sin necesitar acceso a Supabase ni a ninguna herramienta fuera de la app.
- **SC-002**: El 100% de los guardados que dejan una ficha en Privado la
  asignan a la cuenta que hizo ese guardado, verificable inmediatamente
  después (esa cuenta la ve y la puede volver a editar; ninguna otra
  cuenta puede).
- **SC-003**: El 100% de los intentos de guardar una ficha en Privado
  asignándose como dueña a una cuenta distinta de la que realiza la
  operación son rechazados por la base de datos, incluso si se intentan sin
  pasar por el formulario.

## Assumptions

- No se agrega ninguna forma de "reasignar" la dueña de una ficha Privada a
  una tercera cuenta a pedido — la única manera de cambiar de dueña es que
  la propia dueña actual, o cualquier admin mientras la ficha sea Pública,
  la guarde marcada como Privada.
- El campo Tipo sigue sin mostrarse en la ficha pública (`pet-detail.tsx`) —
  mismo alcance que `005-tipo-privado-publico`; el único lugar donde se ve
  hoy es el badge de la tarjeta de la cuadrícula y, para quien edita, el
  propio formulario.
- No se notifica a la dueña anterior cuando pierde acceso a una ficha que
  otra administradora acaba de marcar como Privada para sí misma — fuera de
  alcance (no hay sistema de notificaciones en el proyecto, `CLAUDE.md`).
