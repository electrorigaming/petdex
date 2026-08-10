# Feature Specification: Panel de administración

**Feature Branch**: `002-panel-administracion`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Feature 2 de PetDex: el panel de administración. El catálogo público ya está construido y desplegado. Esta feature agrega la capacidad de que una única cuenta administradora cree y edite el contenido, que hasta ahora se cargaba a mano en la base. Pantalla A — Login: formulario de email y contraseña, sin registro ni recuperación ni proveedores sociales, mensaje genérico ante credenciales incorrectas, redirección tras login a la pantalla de origen o al inicio. Pantalla B — Alta y edición de mascota: un mismo formulario para crear y editar, con nombre (obligatorio), apodos (lista), zona, ubicación, fecha de registro, edad estimada, peso, descripción y estado; foto desde cámara o galería con vista previa e indicador de progreso, liberando el espacio de la foto anterior al reemplazarla; slug autogenerado sin acentos ni caracteres especiales, mostrado antes de guardar, con aviso si ya existe; el slug no cambia al renombrar; confirmación al salir con cambios sin guardar. Pantalla C — Agregar hito: desde la ficha de la mascota, título, fecha (hoy por defecto), categoría opcional y nota opcional, aparece en la timeline sin recargar; los hitos se editan y se borran, con confirmación explícita nombrando el hito al borrar. Transversal: los controles de edición solo son visibles con sesión activa y un visitante sin cuenta ve exactamente lo mismo que antes; la garantía real de que un visitante no pueda escribir es la política de la base de datos, no ocultar botones; toda escritura muestra estado de carga y errores en lenguaje comprensible, nunca el mensaje crudo de Postgres; botón de cerrar sesión visible con sesión activa. Fuera de alcance: múltiples administradores, roles, permisos granulares, historial de cambios, borrado de mascotas, calendario de avistamientos, service worker, offline."

## Clarifications

### Session 2026-08-10

- Q: La feature de catálogo público dejó pendiente, para esta feature, si el campo "estado" de una mascota (activo / sin ver / adoptado / fallecido) afecta su visibilidad en el catálogo público. ¿Qué debe pasar cuando la administradora cambia el estado a "adoptado" o "fallecido"? → A: El estado es solo informativo por ahora — el catálogo público sigue mostrando todas las mascotas sin importar su estado; el campo queda editable pero sin efecto visible hasta una feature futura.
- Q: ¿Qué pasa si alguien intenta adivinar la contraseña de la cuenta administradora probando muchas combinaciones seguidas? → A: Se reemplaza el login por email/contraseña por inicio de sesión con Google (elimina el vector de fuerza bruta por contraseña, ya que la autenticación queda delegada a Google). Además, esta feature pasa a soportar **múltiples** cuentas administradoras: cada una es un email de Google autorizado manualmente en la base, en vez de una única cuenta como decía el pedido original. Este cambio también amplía el alcance general del proyecto (`CLAUDE.md` excluía "múltiples administradores" de la v1) — queda pendiente actualizar esos documentos después de cerrar esta spec.
- Q: ¿Dónde encuentra un visitante el acceso a la pantalla de login si nunca intentó editar nada? → A: Un enlace discreto "Iniciar sesión" visible en toda pantalla pública, con tratamiento visual similar al botón de "cerrar sesión".
- Q: ¿La administradora puede quitarle la foto a una mascota que ya tiene una, dejándola sin foto, sin tener que reemplazarla por otra? → A: Sí — hay un control explícito para quitar la foto actual, liberando su espacio de almacenamiento igual que en un reemplazo, y la mascota vuelve a mostrar el placeholder.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Iniciar sesión como administradora (Priority: P1)

Una persona administradora abre PetDex, va a la pantalla de login, e inicia
sesión con su cuenta de Google — sin crear ni recordar una contraseña nueva
para la app. Si su cuenta de Google no está autorizada como administradora,
el sistema se lo indica sin darle acceso a ningún control de edición. Puede
haber más de una persona administradora, todas con exactamente los mismos
permisos, cada una autorizada por su propio email de Google. Si llegó al
login porque intentó hacer algo que requiere sesión (por ejemplo, tocar
"editar" en una ficha), al loguearse vuelve exactamente ahí; si entró al
login por su cuenta, llega al inicio del catálogo.

**Why this priority**: Es el prerrequisito de todo lo demás — sin poder
iniciar sesión no hay alta ni edición de nada. Además es donde se valida que
la experiencia de un visitante sin cuenta no cambia en absoluto.

**Independent Test**: Con al menos un email de Google ya autorizado como
administrador en la base, se puede probar completamente entrando a la
pantalla de login, iniciando sesión con una cuenta de Google no autorizada
(ver que no obtiene controles de edición) y luego con una cuenta autorizada
(ver que aparecen los controles de edición y el botón de cerrar sesión que
antes no estaban).

**Acceptance Scenarios**:

1. **Given** un visitante sin sesión, **When** inicia sesión con una cuenta
   de Google autorizada como administradora, **Then** queda con sesión activa
   y empieza a ver los controles de edición que antes no veía.
2. **Given** un visitante sin sesión, **When** inicia sesión con una cuenta
   de Google que no está autorizada como administradora, **Then** la
   autenticación con Google puede completarse, pero el sistema no le otorga
   ningún control de edición y se lo indica con claridad.
3. **Given** un visitante que llegó al login tras intentar una acción que
   requiere sesión (por ejemplo, editar una mascota puntual), **When** inicia
   sesión con éxito con una cuenta autorizada, **Then** vuelve exactamente a
   esa pantalla.
4. **Given** un visitante que entró a la pantalla de login directamente (sin
   venir de ninguna acción que la requiriera), **When** inicia sesión con
   éxito con una cuenta autorizada, **Then** llega al inicio del catálogo.
5. **Given** una sesión administradora activa, **When** toca "cerrar sesión",
   **Then** vuelve a ver exactamente lo mismo que un visitante sin cuenta, sin
   ningún control de edición visible.
6. **Given** dos cuentas de Google distintas autorizadas como administradoras,
   **When** cada una inicia sesión por separado, **Then** ambas obtienen
   exactamente los mismos controles de edición, sin diferencias de permisos
   entre ellas.

---

### User Story 2 - Dar de alta y editar una mascota (Priority: P2)

Con sesión activa, la administradora carga una mascota nueva o corrige los
datos de una existente sin tocar la base de datos a mano. Completa nombre,
apodos, zona, ubicación de referencia, fecha de registro, edad estimada,
peso, descripción y estado; elige una foto desde la cámara o la galería del
teléfono y ve una vista previa antes de confirmar; ve el slug que va a tener
la URL pública de la mascota, con aviso si ese slug ya está en uso por otra.

**Why this priority**: Es el motivo de ser de la feature — reemplaza la carga
manual en la base de datos, que es la deuda operativa explícita del proyecto
hasta este punto.

**Independent Test**: Con sesión activa, se puede probar completamente
creando una mascota nueva con todos sus datos y foto, confirmando que aparece
en el catálogo público con el slug mostrado durante el alta, y luego
editándola (cambiando nombre y foto) para confirmar que la URL original
sigue funcionando y la foto vieja ya no está disponible.

**Acceptance Scenarios**:

1. **Given** sesión activa y el formulario de alta con el nombre completado,
   **When** la administradora continúa completando el resto del formulario,
   **Then** el sistema muestra un slug generado automáticamente a partir del
   nombre, sin acentos ni caracteres especiales, antes de guardar.
2. **Given** un slug generado (o corregido a mano) que ya usa otra mascota,
   **When** la administradora intenta guardar, **Then** el sistema avisa el
   conflicto y no guarda hasta que se corrija el slug.
3. **Given** una mascota ya existente con su slug publicado, **When** la
   administradora le cambia el nombre y guarda, **Then** el slug de la URL
   pública de esa mascota no cambia.
4. **Given** el formulario de edición de una mascota con foto ya cargada,
   **When** la administradora sube una foto nueva y guarda, **Then** la ficha
   pública muestra la foto nueva y la foto anterior deja de ocupar espacio de
   almacenamiento.
5. **Given** cambios sin guardar en el formulario de alta o edición, **When**
   la administradora intenta salir sin guardar, **Then** el sistema pide
   confirmación antes de descartar esos cambios.
6. **Given** una foto en proceso de subida, **When** la conexión tarda,
   **Then** el formulario muestra un indicador de progreso hasta que la
   subida termina.
7. **Given** el formulario de alta sin el nombre completado, **When** la
   administradora intenta guardar, **Then** el sistema se lo impide señalando
   que el nombre es obligatorio.
8. **Given** el formulario de edición de una mascota con foto ya cargada,
   **When** la administradora usa el control de quitar la foto (sin subir una
   nueva) y guarda, **Then** la ficha pública muestra el placeholder de foto
   faltante y el archivo anterior deja de ocupar espacio de almacenamiento.

---

### User Story 3 - Registrar y mantener los hitos de una mascota (Priority: P3)

Desde la ficha pública de una mascota, con sesión activa, la administradora
agrega un hito (título, fecha, categoría opcional, nota opcional) que aparece
de inmediato en la línea de tiempo sin recargar la página. También puede
corregir un hito cargado con un error, o borrarlo — en ese caso, el sistema le
pide una confirmación que nombra explícitamente cuál hito se va a eliminar.

**Why this priority**: Agrega valor incremental sobre la ficha ya construida
en la feature de catálogo público, pero necesita que exista al menos una
mascota (User Story 2) — es la historia más aislada y la de menor impacto si
se entrega en último lugar.

**Independent Test**: Con sesión activa, se puede probar completamente
entrando a la ficha de una mascota existente, agregando un hito y viendo que
aparece en la timeline sin recargar la página, editándolo después, y
borrándolo confirmando que el diálogo de borrado nombra el hito correcto.

**Acceptance Scenarios**:

1. **Given** sesión activa en la ficha de una mascota, **When** la
   administradora completa título y fecha (los únicos obligatorios) y
   guarda, **Then** el hito aparece de inmediato en la línea de tiempo sin
   recargar la página, con la fecha de hoy precargada por defecto en el
   formulario.
2. **Given** un hito ya existente, **When** la administradora lo edita y
   guarda, **Then** la línea de tiempo refleja el cambio.
3. **Given** un hito ya existente, **When** la administradora inicia el
   borrado, **Then** el sistema pide una confirmación explícita que nombra el
   hito antes de eliminarlo.
4. **Given** el diálogo de confirmación de borrado de un hito, **When** la
   administradora cancela, **Then** el hito permanece sin cambios.

---

### Edge Cases

- La sesión expira mientras la administradora completa un formulario largo:
  el guardado falla con un mensaje claro que la orienta a volver a loguearse,
  en vez de fallar en silencio o mostrar el error crudo de la base.
- Una persona inicia sesión con una cuenta de Google válida, pero ese email no
  está en la lista de administradores autorizados: se la trata igual que a un
  visitante sin sesión (sin controles de edición), sin exponer si el email
  está o no en la lista.
- Dos sesiones (dos pestañas o dispositivos) editan la misma mascota al mismo
  tiempo: no hay bloqueo ni aviso de conflicto, gana el último guardado.
- El archivo elegido como foto no es una imagen, o no cumple el formato/tamaño
  permitido: el sistema lo rechaza con un mensaje comprensible antes de
  intentar subirlo.
- La administradora corrige a mano el slug propuesto y ese valor corregido
  también está en uso: se avisa igual que con el slug autogenerado en
  conflicto.
- Alguien sin sesión intenta invocar directamente una operación de escritura
  sin pasar por la interfaz (por ejemplo, con una llamada armada a mano): la
  operación se rechaza igual que si no existiera ningún control visible para
  hacerlo.
- Se borra un hito que no tiene categoría ni nota cargada: se borra
  igual, esos campos son opcionales y no afectan el borrado.
- La conexión se corta a mitad de la subida de una foto: el formulario
  muestra un error y permite reintentar sin perder el resto de los datos ya
  completados.

## Requirements *(mandatory)*

### Functional Requirements

**Pantalla A — Login**

- **FR-001**: El sistema MUST proveer un inicio de sesión mediante cuenta de
  Google, sin flujo de registro propio, sin contraseña propia y sin
  recuperación de contraseña.
- **FR-002**: El sistema MUST permitir que más de una cuenta de Google esté
  autorizada como administradora al mismo tiempo, todas con exactamente los
  mismos permisos, sin roles ni niveles diferenciados entre ellas.
- **FR-003**: El sistema MUST negar cualquier control de edición a una cuenta
  de Google que haya iniciado sesión pero no esté autorizada como
  administradora, indicándoselo con claridad sin exponer si esa cuenta figura
  o no en la lista de administradores.
- **FR-004**: El sistema MUST redirigir, tras un login exitoso con una cuenta
  autorizada, a la pantalla desde la que se originó el intento de acceso, o
  al inicio del catálogo si el login se abrió de forma directa.
- **FR-005**: El sistema MUST mostrar un control de cierre de sesión visible
  en toda pantalla mientras haya una sesión administradora activa.
- **FR-006**: El sistema MUST mostrar un enlace de "iniciar sesión" visible
  en toda pantalla pública para cualquier visitante sin sesión activa, de
  forma que el acceso al login sea descubrible sin necesitar conocer su URL
  de antemano.

**Pantalla B — Alta y edición de mascota**

- **FR-007**: El sistema MUST proveer un único formulario, usado tanto para
  crear como para editar una mascota, con los campos: nombre (obligatorio),
  lista de apodos, zona, ubicación de referencia, fecha de registro, edad
  estimada, peso, descripción y estado (activo / sin ver / adoptado /
  fallecido).
- **FR-008**: El sistema MUST impedir guardar una mascota sin nombre.
- **FR-009**: El sistema MUST permitir agregar y quitar apodos de la lista de
  a uno.
- **FR-010**: El sistema MUST permitir elegir una foto desde la cámara o la
  galería del dispositivo y mostrar una vista previa de esa foto antes de
  guardar.
- **FR-011**: El sistema MUST mostrar un indicador de progreso mientras la
  foto se sube.
- **FR-012**: El sistema MUST liberar el espacio de almacenamiento ocupado
  por la foto anterior de una mascota cuando se la reemplaza por una nueva.
- **FR-013**: El sistema MUST permitir quitarle la foto a una mascota que ya
  tiene una, sin necesidad de reemplazarla por otra, liberando el espacio de
  almacenamiento igual que en un reemplazo; la mascota vuelve a mostrar el
  placeholder de foto faltante.
- **FR-014**: El sistema MUST generar automáticamente un slug a partir del
  nombre de la mascota, sin acentos ni caracteres especiales, y mostrárselo a
  la administradora antes de guardar.
- **FR-015**: El sistema MUST avisar cuando el slug (generado o corregido a
  mano) ya está en uso por otra mascota, e impedir guardar hasta que se
  corrija.
- **FR-016**: El sistema MUST mantener sin cambios el slug de una mascota
  cuando se edita su nombre u otro campo, de forma que cualquier URL ya
  compartida siga resolviendo a la misma mascota.
- **FR-017**: El sistema MUST pedir confirmación antes de descartar cambios
  sin guardar al intentar salir del formulario de alta o edición de mascota.

**Pantalla C — Hitos**

- **FR-018**: El sistema MUST proveer, desde la ficha pública de una mascota
  y solo con sesión activa, un formulario para agregar un hito con título
  (obligatorio), fecha (obligatoria, con la fecha de hoy precargada por
  defecto), categoría (opcional) y nota (opcional).
- **FR-019**: El sistema MUST mostrar el hito recién guardado en la línea de
  tiempo de la ficha inmediatamente, sin requerir recargar la página.
- **FR-020**: El sistema MUST permitir editar y borrar hitos existentes con
  sesión activa.
- **FR-021**: El sistema MUST pedir, antes de borrar un hito, una
  confirmación explícita que nombre el hito puntual que se va a eliminar.

**Transversales**

- **FR-022**: El sistema MUST ocultar todos los controles de creación y
  edición (alta de mascota, edición de mascota, alta/edición/borrado de
  hitos) a cualquier visitante sin sesión activa, de forma que su experiencia
  sea idéntica a la de antes de esta feature.
- **FR-023**: El sistema MUST garantizar, mediante políticas de la base de
  datos —no solo ocultando controles en la interfaz—, que ninguna operación
  de escritura sobre mascotas o hitos se complete sin una sesión
  administradora válida, incluso si se invoca la operación directamente sin
  pasar por la interfaz.
- **FR-024**: El sistema MUST mostrar un estado de carga visible durante toda
  operación de escritura: guardar mascota, subir foto, guardar hito, borrar
  hito.
- **FR-025**: El sistema MUST traducir cualquier error ocurrido durante una
  operación de escritura a un mensaje en lenguaje comprensible para la
  administradora, sin exponer el mensaje crudo de la base de datos.
- **FR-026**: El sistema MUST mantener el campo "estado" de una mascota como
  dato puramente informativo en esta feature: el catálogo público MUST NOT
  filtrar ni cambiar la presentación de una mascota según su estado
  (incluyendo "adoptado" o "fallecido"), y sigue mostrando todas las mascotas
  igual que antes de esta feature.

### Key Entities *(include if feature involves data)*

- **Sesión administradora**: la sesión de una cuenta de Google cuyo email está
  autorizado manualmente como administrador. Puede haber más de una cuenta
  autorizada al mismo tiempo; todas habilitan exactamente los mismos
  controles de creación y edición, sin roles ni niveles de permiso
  diferenciados entre ellas.
- **Mascota** *(ya existe, ahora editable)*: los mismos atributos definidos
  en la feature de catálogo público, más la capacidad de crearse y
  modificarse desde esta feature en lugar de cargarse a mano en la base.
- **Hito** *(ya existe, ahora editable)*: los mismos atributos definidos en
  la feature de catálogo público, más alta, edición y borrado desde esta
  feature.
- **Foto de mascota**: el archivo de imagen asociado a una mascota. Se
  reemplaza como unidad completa —subir una nueva libera el espacio de la
  anterior—, nunca se edita en el lugar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La administradora completa el alta de una mascota nueva (datos
  y foto) en menos de 3 minutos, sin necesitar ayuda externa ni acceso
  directo a la base de datos.
- **SC-002**: El 100% de los intentos de escritura sobre mascotas o hitos
  realizados sin una sesión administradora válida son rechazados, incluso
  cuando se invocan sin pasar por la interfaz.
- **SC-003**: Un hito recién agregado aparece en la línea de tiempo de la
  ficha en menos de 2 segundos después de guardarlo, sin recargar la página.
- **SC-004**: Cero URLs de mascotas existentes dejan de resolver después de
  que la administradora edite el nombre de esa mascota.
- **SC-005**: Un visitante sin sesión no percibe ninguna diferencia visual ni
  funcional en el catálogo o las fichas respecto de la versión anterior a
  esta feature.
- **SC-006**: Una administradora completa el login con una cuenta de Google
  autorizada y llega a la pantalla correcta (la de origen, o el inicio) en
  menos de 10 segundos, incluyendo la carga de la página.

## Assumptions

- Los emails de Google autorizados como administradores se cargan
  manualmente fuera de esta feature (directamente en la base); esta feature
  solo construye el flujo de login contra esa lista ya existente, nunca una
  pantalla para gestionarla.
- No hay roles ni jerarquía entre administradores: cualquier cuenta de Google
  autorizada tiene exactamente los mismos permisos que cualquier otra, sin
  distinción de "admin principal" vs "admin secundario".
- Los controles para crear una mascota nueva y para editar una existente
  aparecen integrados en las pantallas públicas ya construidas (catálogo y
  ficha) cuando hay sesión activa, en vez de vivir en una pantalla
  administrativa separada; no se agrega una cuarta pantalla de "listado
  administrativo".
- La confirmación de borrado de un hito se satisface mostrando su título en
  el propio diálogo de confirmación (por ejemplo, "¿Borrar el hito 'Primera
  vacuna'?"); no se exige que la administradora escriba el nombre para
  confirmar, dado que es una operación de bajo riesgo sobre un dato puntual.
- No hay bloqueo optimista entre sesiones concurrentes: si la misma mascota
  se edita desde dos pestañas o dispositivos a la vez, gana el último
  guardado — no se construye resolución de conflictos en esta feature.
- Las categorías de hito disponibles son las cuatro ya definidas en la
  feature de catálogo público: salud, alimentación, comportamiento, otro.
- Esta feature no agrega borrado de mascotas ni un flujo de adopciones: solo
  alta y edición de mascotas, y alta, edición y borrado de hitos, tal como lo
  delimita el pedido original.
- La confirmación al salir con cambios sin guardar (FR-017) aplica solo al
  formulario de mascota, tal como lo pidió el alcance original; el formulario
  de hitos es corto y no la requiere.
- Esta app no gestiona contraseñas propias ni su recuperación: al delegar el
  login a Google, cualquier problema de acceso a la cuenta de Google (olvido
  de contraseña, verificación en dos pasos, etc.) se resuelve enteramente
  dentro de Google, sin ninguna pantalla propia de PetDex.
- Autorizar o desautorizar un email como administrador es un procedimiento
  manual fuera de esta feature (directamente en la base); no se construye una
  pantalla para que una administradora agregue o quite a otra.
