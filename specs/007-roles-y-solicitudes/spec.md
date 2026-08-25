# Feature Specification: Rol Usuario, solicitud de cuenta y registro de modificaciones

**Feature Branch**: `007-roles-y-solicitudes`

**Created**: 2026-08-24

**Status**: Draft

**Input**: User description: "quiero agregar un campo en las mascotas que sea un registro de modificaciones, es decir, que guarde quien edito, agrego algo en el registro de la mascota. Adicionalmente quiero crear un rol de Usuario distinto al de administrador que puede editar agregar hitos y marcar visto/no visto, pero no editar o eliminar la mascota. también añadir en la pantalla de inicio de sesión una opción para solicitar una cuenta de usuario, la cual debe ser aprobada por una cuenta admin desde la app"

## Clarifications

### Session 2026-08-24

- Q: ¿Cómo se modelan los roles, dado que hoy solo existe la tabla de administradoras? → A: Con una tabla unificada de cuentas de la aplicación (reemplaza a la actual de administradoras) que guarda, para cada persona con acceso, su rol y un nombre visible — sirve a la vez para los permisos, para la cola de solicitudes y para mostrar "quién editó" en el historial.
- Q: ¿Qué tan detallado es el registro de modificaciones? → A: Por evento ("María editó la ficha", "Juan agregó el hito Vacuna"), no por campo — no se guarda el valor anterior/nuevo de cada dato modificado.
- Q: ¿El rol Usuario puede eliminar hitos y avistamientos, o solo agregar/editar? → A: Sí, puede eliminar — mismos permisos que una administradora sobre hitos y avistamientos.
- Q: ¿Quién puede ver el registro de modificaciones de una mascota? → A: Solo cuentas administradoras — expone nombres/emails de vecinas y vecinos que colaboran, así que no es público ni visible para cuentas Usuario.
- Q: ¿Cómo se solicita una cuenta de Usuario? → A: Con un formulario público en la pantalla de login (nombre + email), sin necesidad de iniciar sesión con Google primero. El enganche real del acceso ocurre cuando esa persona efectivamente inicia sesión con Google usando ese mismo email, después de que una administradora aprobó la solicitud.
- Q: Una vez aprobada, ¿se puede revocar el acceso de una cuenta Usuario más adelante? → A: Sí, desde el mismo panel donde se aprueban solicitudes.

### Session 2026-08-24 (revisión posterior a la primera aprobación)

- Q: ¿El rol Usuario puede crear mascotas? → A: Sí, pero únicamente con Tipo Privado — queda asociada a esa cuenta como su creadora, con las mismas reglas de aislamiento que ya tiene una mascota Privada creada por una administradora (`005-tipo-privado-publico`).
- Q: ¿Puede editar y eliminar esas mascotas privadas propias? → A: Sí, ficha completa (todos los campos salvo Tipo) y eliminarlas, en cualquier momento después de crearlas.
- Q: ¿Puede cambiar el campo Tipo (Público ↔ Privado)? → A: No, nunca — ni al crear (siempre queda Privado, sin poder elegir Público) ni al editar después. Las administradoras conservan el comportamiento ya existente (`006-tipo-editable-formulario`, pueden cambiar Tipo desde el formulario) pero solo sobre mascotas que ya pueden ver.
- Q: ¿Una administradora puede ver, editar o eliminar una mascota privada creada por una cuenta Usuario? → A: No — mismo aislamiento que ya existe hoy entre dos administradoras distintas: una mascota Privada solo es visible y editable por la cuenta que la creó, sin excepción por rol.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Una cuenta Usuario gestiona su propio seguimiento diario y sus propias mascotas privadas (Priority: P1)

Una persona del barrio, distinta de las administradoras, tiene una cuenta con rol Usuario (dada de alta por una administradora). Cuando entra con su cuenta de Google, puede agregar y editar hitos de cualquier mascota pública y marcar si la vio o no la vio en un día — exactamente las mismas acciones que hoy hace una administradora en el seguimiento diario. Además, puede cargar sus propias mascotas, pero solo como registros Privados (visibles únicamente para ella): puede crearlas, editar su ficha y eliminarlas libremente, igual que ya puede hacer una administradora con sus propias mascotas Privadas. Lo único que nunca puede hacer, ni sobre una mascota pública ni sobre una privada propia, es cambiar si una mascota es Pública o Privada, ni tocar de ninguna forma una mascota Pública (crearla, editarla, eliminarla) o una Privada que no haya creado ella misma.

**Why this priority**: Es el corazón de la feature — sin la distinción de permisos entre Administradora y Usuario, nada más tiene sentido. Es probable independientemente del resto: una cuenta Usuario puede darse de alta a mano (mismo criterio operativo que hoy se usa para administradoras) sin que exista todavía ningún flujo de solicitud.

**Independent Test**: Con una cuenta Usuario ya dada de alta, se prueba completo: inicia sesión, agrega/edita/elimina un hito y marca un avistamiento en una mascota pública; crea una mascota propia (queda Privada sin poder elegir otra cosa), la edita, la elimina; confirma que no hay ningún control para crear/editar/eliminar una mascota Pública ni para cambiar el Tipo de ninguna mascota; y confirma que una mascota Privada de otra cuenta (Usuario o administradora) es completamente invisible para ella.

**Acceptance Scenarios**:

1. **Given** una cuenta Usuario con sesión activa en la ficha de una mascota pública, **When** agrega, edita o elimina un hito, **Then** la operación se completa igual que hoy le funciona a una administradora.
2. **Given** una cuenta Usuario en la ficha de una mascota pública, **When** marca el día de hoy como visto, o lo corrige a revisado-y-no-estaba, **Then** el cambio se refleja de inmediato en el calendario y en la cuadrícula, igual que con una administradora.
3. **Given** una cuenta Usuario con sesión activa, **When** crea una mascota nueva, **Then** la mascota se guarda con Tipo Privado (sin que el formulario le ofrezca la opción de Público) y queda asociada a su cuenta.
4. **Given** una mascota Privada creada por esa misma cuenta Usuario, **When** edita su ficha (nombre, foto, zona, cualquier dato salvo Tipo), **Then** los cambios se guardan con normalidad.
5. **Given** la misma mascota, **When** la elimina, **Then** se borra (con la misma franja de Deshacer que ya existe para administradoras).
6. **Given** una cuenta Usuario con sesión activa, **When** navega la cuadrícula o la ficha de cualquier mascota Pública, **Then** no ve ningún botón para crear, editar o eliminar esa mascota, ni para cambiar su Tipo.
7. **Given** una mascota Privada creada por otra cuenta (sea otra cuenta Usuario o una administradora), **When** la cuenta Usuario navega el catálogo o intenta acceder directo a su URL, **Then** esa mascota es invisible para ella, exactamente igual que ya ocurre hoy entre dos administradoras con mascotas Privadas distintas.
8. **Given** una mascota Privada creada por esa cuenta Usuario, **When** intenta cambiar su Tipo a Público (desde la interfaz o sin pasar por ella), **Then** la operación es rechazada.
9. **Given** una cuenta Usuario, **When** intenta crear, editar o eliminar una mascota Pública sin pasar por la interfaz (por ejemplo, repitiendo una petición), **Then** la operación es rechazada por el sistema.
10. **Given** dos cuentas Usuario distintas, **When** cualquiera de las dos edita un hito o avistamiento de una mascota Pública cargado por la otra, **Then** puede hacerlo sin restricción — no hay jerarquía entre cuentas del mismo rol, igual que ya ocurre hoy entre administradoras.

---

### User Story 2 - Una administradora ve quién hizo cada cambio en una mascota (Priority: P2)

Dentro de la ficha de una mascota, una administradora abre una sección "Historial" y ve, en orden cronológico, cada acción relevante que se hizo sobre esa mascota: quién la creó, quién editó la ficha, quién agregó, editó o eliminó cada hito, y quién marcó cada avistamiento — con el nombre de la cuenta y cuándo. Una cuenta Usuario, o cualquier visitante, no ve esta sección en ningún caso. Como una mascota Privada solo es visible para quien la creó, en la práctica una administradora únicamente ve el Historial de las mascotas Públicas y de sus propias Privadas — nunca el de una mascota Privada creada por una cuenta Usuario, porque esa mascota le es invisible por completo (mismo alcance que el resto de la app).

**Why this priority**: Da valor por sí sola apenas existe una cuenta con permisos de escritura además de la administradora que instaló el sistema — no necesita que el flujo de solicitud esté construido, alcanza con que haya más de una cuenta con acceso (por ejemplo, dos administradoras, o una administradora y una Usuario dada de alta a mano).

**Independent Test**: Con dos cuentas distintas con permisos de escritura sobre una misma mascota Pública, se hacen varias acciones alternadas (editarla, agregar un hito, marcar un avistamiento) desde cada cuenta, y se verifica que la sección Historial de esa mascota lista cada acción con la cuenta correcta y en el orden correcto, visible solo para administradoras.

**Acceptance Scenarios**:

1. **Given** una mascota recién creada por la cuenta A, **When** una administradora abre su Historial (si puede ver esa mascota), **Then** ve un registro de creación atribuido a la cuenta A.
2. **Given** una mascota Pública, **When** la cuenta B edita su ficha, agrega un hito y marca un avistamiento, **Then** el Historial suma tres registros nuevos, cada uno atribuido a la cuenta B, en el orden en que ocurrieron.
3. **Given** un hito eliminado, **When** una administradora revisa el Historial, **Then** encuentra el registro de esa eliminación con la cuenta que la hizo, aunque el hito ya no exista en la línea de tiempo.
4. **Given** una sesión con rol Usuario o sin sesión, **When** se visita la ficha de cualquier mascota, **Then** la sección Historial no aparece en ningún caso.
5. **Given** una cuenta cuyo acceso fue revocado más adelante, **When** una administradora revisa acciones antiguas de esa cuenta en el Historial, **Then** el registro sigue mostrando el nombre con el que actuó en su momento, en vez de desaparecer o mostrar un error.

---

### User Story 3 - Alguien del barrio solicita una cuenta Usuario y una administradora la aprueba (Priority: P3)

Una persona sin cuenta entra a la pantalla de inicio de sesión y, sin necesidad de autenticarse primero, completa un formulario corto (nombre y email) para pedir acceso como Usuario. Más tarde, una administradora entra a un panel de solicitudes, ve el pedido pendiente y lo aprueba (o lo rechaza). La próxima vez que esa persona inicia sesión con su cuenta de Google usando el mismo email que puso en el formulario, ya tiene el rol Usuario habilitado, sin ningún paso adicional de su parte. Desde ese mismo panel, una administradora también puede revocarle el acceso a una cuenta Usuario ya aprobada.

**Why this priority**: Es la funcionalidad más visible para alguien externo al barrio, pero depende de que ya exista el rol Usuario (User Story 1) para tener sentido — sin un rol al que asignar, aprobar una solicitud no haría nada.

**Independent Test**: Se completa el formulario de solicitud con un email real de prueba sin haber iniciado sesión antes, se aprueba desde el panel de administración, y se confirma que al iniciar sesión con Google con ese mismo email la cuenta ya tiene rol Usuario. Por separado, se prueba el rechazo (la cuenta nunca queda habilitada) y la revocación de una cuenta ya aprobada (deja de poder editar).

**Acceptance Scenarios**:

1. **Given** la pantalla de inicio de sesión, **When** alguien sin sesión completa el formulario de solicitud con nombre y email, **Then** la solicitud queda registrada como pendiente, sin que la persona haya iniciado sesión con Google en ningún momento.
2. **Given** una solicitud pendiente, **When** una administradora abre el panel de solicitudes, **Then** la ve listada con el nombre y el email indicados.
3. **Given** una solicitud pendiente, **When** una administradora la aprueba, **Then** la solicitud pasa a estado aprobada y la persona todavía no tiene acceso (falta que inicie sesión).
4. **Given** una solicitud aprobada, **When** la persona inicia sesión con Google usando el mismo email de la solicitud, **Then** su cuenta queda con rol Usuario de forma automática, sin que tenga que volver a pedir nada.
5. **Given** una solicitud pendiente, **When** una administradora la rechaza en lugar de aprobarla, **Then** esa persona, si más adelante inicia sesión con ese email, no obtiene ningún rol.
6. **Given** una cuenta Usuario ya aprobada y activa, **When** una administradora la revoca desde el panel, **Then** esa cuenta deja de poder agregar hitos, marcar avistamientos, o crear/editar/eliminar sus mascotas Privadas, aunque siga pudiendo iniciar sesión y mirar el registro público como cualquier visitante.
7. **Given** alguien que ya envió una solicitud pendiente, **When** intenta enviar otra con el mismo email antes de que se resuelva la primera, **Then** el sistema no crea una segunda solicitud duplicada.
8. **Given** una persona con una solicitud pendiente, **When** inicia sesión con Google con ese mismo email antes de que una administradora la resuelva, **Then** ve un mensaje indicando que su solicitud todavía está pendiente, en vez del mensaje genérico de cuenta sin acceso.

---

### Edge Cases

- Alguien completa el formulario de solicitud con un email que ya pertenece a una cuenta administradora o Usuario existente: la solicitud no otorga ni cambia ningún permiso — la cuenta ya tenía acceso por otra vía.
- Una solicitud es rechazada y, más adelante, la misma persona vuelve a solicitar con el mismo email: puede volver a intentarlo (el rechazo no bloquea solicitudes futuras).
- Una cuenta Usuario cuyo acceso fue revocado tenía mascotas Privadas propias: esas mascotas permanecen en la base, invisibles para todo el mundo (incluidas las administradoras) hasta que una administradora las reasigne a mano por SQL — mismo criterio ya aceptado hoy cuando se elimina una cuenta administradora dueña de una Privada (`005-tipo-privado-publico`).
- Una administradora borra una mascota (Pública, o su propia Privada) y la restaura con la función de deshacer: el Historial de esa mascota no se conserva a través del borrado — vuelve a empezar vacío, tal como ya se acepta hoy que la foto anterior puede quedar huérfana en el almacenamiento en ese mismo flujo. El mismo criterio aplica cuando quien borra y restaura es una cuenta Usuario sobre su propia mascota Privada.
- Una mascota se elimina de forma permanente (fuera de la ventana de deshacer): no queda ningún registro de Historial que mostrar, porque la mascota misma ya no existe.
- Una cuenta cuya sesión de Google fue revocada por Google (no por una administradora) simplemente deja de poder iniciar sesión; no es un caso que la aplicación necesite manejar de forma especial.

## Requirements *(mandatory)*

### Functional Requirements

**Rol Usuario — seguimiento diario**

- **FR-001**: El sistema MUST reconocer, además del rol Administradora ya existente, un rol Usuario, asignable a cuentas de Google individuales.
- **FR-002**: El sistema MUST permitir que una cuenta con rol Usuario agregue, edite y elimine hitos de cualquier mascota Pública, con las mismas reglas que ya aplican hoy a una administradora.
- **FR-003**: El sistema MUST permitir que una cuenta con rol Usuario marque el estado de un avistamiento (visto / revisado y no estaba) de cualquier mascota Pública, con las mismas reglas que ya aplican hoy a una administradora, incluida la marca rápida desde la cuadrícula.

**Rol Usuario — mascotas propias**

- **FR-004**: El sistema MUST permitir que una cuenta con rol Usuario cree una mascota, siempre con Tipo Privado — sin ofrecerle nunca la opción de crearla como Pública — quedando asociada a esa cuenta como su creadora, con el mismo aislamiento que ya tiene una mascota Privada creada por una administradora (`005-tipo-privado-publico`).
- **FR-005**: El sistema MUST permitir que una cuenta con rol Usuario edite la ficha completa (todos los campos salvo Tipo) y elimine únicamente las mascotas Privadas que ella misma creó.
- **FR-006**: El sistema MUST NOT permitir que una cuenta con rol Usuario cree una mascota Pública, ni edite o elimine ninguna mascota Pública, ni edite o elimine ninguna mascota Privada que no haya creado ella misma (sea de otra cuenta Usuario o de una administradora), ni mostrarle en la interfaz ningún control para esos casos.
- **FR-007**: El sistema MUST NOT permitir que una cuenta con rol Usuario cambie el campo Tipo de ninguna mascota en ningún momento — ni al crearla (queda fijo en Privado) ni al editarla después.
- **FR-008**: El sistema MUST mantener, sin cambios, que una cuenta administradora pueda cambiar el Tipo de cualquier mascota que ya pueda ver (Pública, o Privada creada por ella misma) — comportamiento ya existente de `006-tipo-editable-formulario`. Una mascota Privada creada por una cuenta Usuario queda fuera del alcance de cualquier administradora: ninguna la ve, la edita, la elimina ni le cambia el Tipo, exactamente igual que ya ocurre hoy entre dos administradoras con mascotas Privadas distintas.
- **FR-009**: El sistema MUST garantizar las restricciones de FR-004 a FR-008 mediante política de la base de datos, no solo ocultando controles en la interfaz — un intento directo, sin pasar por la interfaz, también MUST ser rechazado.
- **FR-010**: El sistema MUST NOT establecer ninguna jerarquía entre cuentas del mismo rol (Usuario o Administradora) sobre lo que ambas pueden ver y escribir por igual (mascotas Públicas, hitos, avistamientos) — cualquier cuenta de un rol puede actuar sobre lo cargado por otra cuenta del mismo rol dentro de ese alcance compartido, igual que ya ocurre hoy entre administradoras.

**Registro de modificaciones**

- **FR-011**: El sistema MUST registrar, para cada mascota, un evento cuando: se crea la mascota, se edita su ficha, se agrega un hito, se edita un hito, se elimina un hito, y se marca un avistamiento.
- **FR-012**: Cada evento registrado MUST incluir qué cuenta lo hizo, qué tipo de acción fue, y cuándo ocurrió.
- **FR-013**: El sistema MUST conservar, en cada evento, el nombre con el que actuó la cuenta en su momento, de forma que el registro siga siendo legible aunque esa cuenta pierda el acceso más adelante.
- **FR-014**: El sistema MUST mostrar el registro de modificaciones de una mascota únicamente a cuentas administradoras, en una sección dedicada dentro de su ficha; MUST NOT mostrarlo a cuentas Usuario ni a visitantes sin sesión.
- **FR-015**: El sistema MUST garantizar que el registro de modificaciones se genera de forma automática al ocurrir cada acción cubierta por FR-011, sin depender de un paso adicional que alguien pueda olvidar.
- **FR-016**: El sistema MUST NOT permitir que el registro de modificaciones sea editado ni eliminado manualmente por ninguna cuenta, incluidas las administradoras — solo se genera, nunca se corrige.

**Solicitud y aprobación de cuentas**

- **FR-017**: El sistema MUST ofrecer, en la pantalla de inicio de sesión, un formulario público para solicitar una cuenta Usuario, sin exigir que quien lo completa haya iniciado sesión con Google.
- **FR-018**: El formulario de solicitud MUST pedir al menos un nombre para mostrar y un email de contacto.
- **FR-019**: El sistema MUST impedir que la misma dirección de email tenga más de una solicitud pendiente al mismo tiempo.
- **FR-020**: El sistema MUST ofrecer a cualquier cuenta administradora un panel donde ver las solicitudes pendientes y aprobarlas o rechazarlas.
- **FR-021**: El sistema MUST otorgar el rol Usuario a una cuenta de Google recién autenticada cuando su email coincide con el de una solicitud aprobada que todavía no fue vinculada a ninguna cuenta — sin exigirle a esa persona ningún paso adicional más allá de iniciar sesión.
- **FR-022**: El sistema MUST NOT otorgar ningún rol a partir de una solicitud rechazada o todavía pendiente.
- **FR-023**: El sistema MUST permitir que una cuenta administradora revoque, desde el mismo panel, el acceso de una cuenta que ya tiene rol Usuario.
- **FR-024**: Una cuenta a la que se le revocó el acceso MUST perder de inmediato los permisos de escritura del rol Usuario, aunque MUST seguir pudiendo iniciar sesión y navegar el registro público como cualquier visitante.
- **FR-025**: El sistema MUST mostrar, a una cuenta de Google recién autenticada cuya solicitud sigue pendiente, un mensaje que lo indique explícitamente, distinto del mensaje que ve una cuenta sin ninguna solicitud.
- **FR-026**: El sistema MUST garantizar que solo cuentas administradoras pueden aprobar, rechazar o revocar solicitudes y accesos — un intento directo por parte de cualquier otra cuenta, sin pasar por la interfaz, también MUST ser rechazado.

### Key Entities *(include if feature involves data)*

- **Cuenta de la aplicación** *(reemplaza a la actual noción de "administradora" como única cuenta con acceso)*: representa a cada persona con permisos de escritura, con un rol (Administradora o Usuario) y un nombre para mostrar. Las administradoras existentes pasan a ser cuentas de este tipo con rol Administradora, sin cambio de comportamiento para ellas.
- **Solicitud de cuenta**: un pedido de acceso con nombre, email y un estado (pendiente, aprobada o rechazada). Existe de forma independiente de la Cuenta de la aplicación hasta que la persona solicitante efectivamente inicia sesión con ese email — recién ahí se convierte en una Cuenta con rol Usuario.
- **Evento de historial**: una entrada de solo lectura asociada a una mascota, con la cuenta que actuó (o su nombre congelado, si esa cuenta ya no existe), el tipo de acción y cuándo ocurrió. Vive y muere junto con la mascota a la que pertenece.
- **Mascota** *(ya existe, extiende `005-tipo-privado-publico`)*: su "cuenta creadora" (relevante solo cuando el Tipo es Privado) ya no es exclusivamente una administradora — ahora también puede ser una cuenta Usuario, con exactamente las mismas reglas de aislamiento que ya existían entre administradoras (solo la creadora la ve y la edita). El campo Tipo en sí solo lo puede cambiar una administradora, y únicamente sobre mascotas que ya puede ver.
- **Hito**, **Avistamiento** *(ya existen)*: no suman atributos propios, pero sus reglas de quién puede escribirlos pasan a incluir al nuevo rol Usuario, dentro del mismo alcance de visibilidad que ya define el Tipo de la mascota a la que pertenecen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una cuenta con rol Usuario puede completar el flujo diario de seguimiento — agregar un hito, marcar un avistamiento — sobre cualquier mascota Pública, sin necesitar ayuda de una administradora.
- **SC-002**: Una cuenta con rol Usuario puede crear, editar y eliminar sus propias mascotas Privadas de punta a punta, sin encontrar en ningún momento la opción de marcarlas como Públicas ni un control para tocar una mascota Pública o una Privada ajena.
- **SC-003**: El 100% de los intentos de crear/editar/eliminar una mascota Pública, de tocar una mascota Privada ajena, o de cambiar el Tipo de cualquier mascota, realizados por una cuenta Usuario, con o sin pasar por la interfaz, son rechazados por la base de datos.
- **SC-004**: Una administradora puede reconstruir, para cualquier mascota que pueda ver, quién hizo cada cambio relevante (creación, edición de ficha, altas/bajas de hitos, marcas de avistamiento) revisando únicamente la sección Historial de esa ficha, sin consultar nada fuera de la aplicación.
- **SC-005**: Una persona puede pasar de "sin acceso" a "puede editar hitos y avistamientos y cargar sus propias mascotas privadas" completando el formulario de solicitud, esperando la aprobación de una administradora, e iniciando sesión con Google una sola vez — sin ningún paso técnico adicional de su parte.
- **SC-006**: Una administradora puede revocar el acceso de una cuenta Usuario, y esa cuenta pierde la capacidad de editar antes de su próxima acción de escritura (no hace falta esperar a que cierre sesión).

## Assumptions

- Esta feature reemplaza la tabla actual de administradoras por una noción más general de "cuenta de la aplicación" con rol; las administradoras existentes se migran automáticamente con rol Administradora, sin ninguna acción manual por mascota ni pérdida de acceso.
- El alta de la primera cuenta (sea Administradora o Usuario) sigue pudiendo hacerse operando directo sobre la base de datos, con el mismo criterio ya usado hoy para administradoras — el flujo de solicitud (User Story 3) es un camino adicional, no el único.
- Una mascota Privada creada por una cuenta Usuario sigue exactamente las mismas reglas de aislamiento que ya rigen entre dos administradoras (`005-tipo-privado-publico`): solo su creadora la ve o la edita, sin excepción alguna por rol — incluida una administradora, que no tiene ninguna forma de supervisar o intervenir sobre una Privada de un Usuario. Confirmado explícitamente con el usuario.
- El registro de modificaciones es por evento, no por campo: no queda guardado el valor anterior y nuevo de cada dato editado, solo que una edición ocurrió, quién la hizo y cuándo.
- El registro de modificaciones no sobrevive al borrado permanente de una mascota (incluido el caso de deshacer un borrado y volver a restaurarla) — mismo criterio de trade-off aceptado que ya existe para el archivo de foto huérfano en ese flujo.
- No hay notificación (email u otro medio) hacia las administradoras cuando llega una solicitud nueva — se enteran al entrar al panel. Fuera de alcance de esta feature.
- No se admite un tercer rol, ni niveles intermedios de permisos, ni jerarquía entre cuentas del mismo rol — fuera de alcance de esta feature.
- El nombre para mostrar de una cuenta aprobada por solicitud no se puede editar después desde la aplicación — fuera de alcance de esta feature.
- Esta feature extiende el modelo de permisos definido en `002-panel-administracion` (RLS, cuentas sin jerarquía entre sí) y el de Tipo Privado/Público de `005-tipo-privado-publico`/`006-tipo-editable-formulario`: el concepto de "cuenta creadora" de una mascota Privada, antes exclusivo de administradoras, ahora también admite cuentas Usuario, sin cambiar ninguna otra regla de esas dos features.
