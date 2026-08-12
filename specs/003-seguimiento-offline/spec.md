# Feature Specification: Seguimiento diario y funcionamiento offline

**Feature Branch**: `003-seguimiento-offline`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Feature 3 de PetDex: el seguimiento diario y el funcionamiento offline. El catálogo público y el panel de administración ya están construidos y desplegados. Esta feature agrega el registro día a día de si cada animal fue visto, y hace que la aplicación sirva estando en la calle sin conexión estable. Calendario de avistamientos, en la ficha de cada mascota — vista mensual, navegable hacia meses anteriores. Cada día muestra uno de tres estados, visualmente distinguibles entre sí y sin depender solo del color: visto, revisado y no estaba, sin registro. Los tres son estados distintos y no deben colapsarse a dos. Junto al calendario: total de días visto en el mes en curso, y racha actual de días consecutivos visto. Un día marcado como revisado y no estaba corta la racha; un día sin registro no la corta pero tampoco la extiende. No se muestran días posteriores a hoy ni anteriores a la fecha de registro del animal. Marcado del día: desde la ficha, con sesión de administrador, un control que permite registrar el día de hoy como visto o como revisado y no estaba, y también cambiar el registro si se marcó por error. Marcar dos veces el mismo día no crea registros duplicados: reemplaza el anterior. Debe poder usarse de pie en la calle, con una sola mano y sin mirar mucho. Es el gesto más frecuente de toda la aplicación. También se puede registrar un día pasado desde el calendario, para cargar algo que se olvidó. Nunca un día futuro. Funcionamiento sin conexión: la aplicación se puede instalar en el teléfono y abrir desde el ícono como una app. Sin conexión, muestra el último contenido que alcanzó a cargar: la cuadrícula, las fichas visitadas y sus fotos. Deja claro que lo que se ve puede estar desactualizado y desde cuándo. Un avistamiento marcado sin conexión queda pendiente y se envía solo al recuperar señal. Mientras tanto se muestra con un estado visual propio, distinto de un avistamiento ya confirmado. La fecha que se registra es la del momento en que se marcó, no la del momento en que se sincroniza. Si el mismo día de la misma mascota se marca varias veces estando sin conexión, vale el último valor. Si al sincronizar un registro falla de forma permanente, se avisa al usuario en vez de descartarlo en silencio. Fuera de alcance: avistamientos por parte de visitantes sin cuenta, notificaciones push, geolocalización, exportación de datos, estadísticas más allá del total mensual y la racha."

## Clarifications

### Session 2026-08-10

- Q: Cuando la administradora está sin conexión, ¿el marcado offline aplica solo al control rápido del día de hoy, o también a la carga/corrección de días pasados desde el calendario? → A: Solo el marcado del día de hoy funciona sin conexión; corregir un día pasado desde el calendario requiere conexión.
- Q: ¿Los avistamientos pendientes de sincronizar cuentan de inmediato para el total del mes y la racha, o solo después de confirmarse? → A: Cuentan de inmediato — el total y la racha incluyen los días marcados aunque estén pendientes de sincronizar.
- Q: Cuando un avistamiento pendiente falla al sincronizar de forma permanente, ¿qué puede hacer la administradora con ese aviso? → A: Solo descartarlo — el aviso explica qué pasó y ofrece un botón para descartar el registro pendiente fallido; si quiere reintentar, vuelve a marcar el día desde cero.
- Q: ¿Qué tipo de error cuenta como "falla permanente" de sincronización, distinta de una falla temporal de red que sigue reintentando sola? → A: Rechazo explícito del servidor (por ejemplo, la mascota ya no existe o la política de la base lo rechaza). Cualquier otro caso —sin respuesta, timeout, sin conexión— se trata como temporal y sigue reintentando solo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Marcar el avistamiento de hoy (Priority: P1)

Una administradora está parada en la calle frente a un animal. Abre la ficha
de esa mascota en el celular y, con un solo toque y sin necesitar mirar la
pantalla con atención, marca el día de hoy como "visto" o como "revisado y no
estaba". Si se equivoca, puede corregir el registro de hoy tocando de nuevo
sin que se dupliquen registros.

**Why this priority**: Es el gesto más frecuente de toda la aplicación y el
que justifica el resto de la feature — sin esto, ningún calendario tiene datos
que mostrar.

**Independent Test**: Con sesión de administradora en la ficha de una mascota
ya existente, se puede probar completamente marcando el día de hoy como
"visto", verificando que queda registrado, corrigiéndolo a "revisado y no
estaba" y confirmando que sigue habiendo un único registro para hoy.

**Acceptance Scenarios**:

1. **Given** sesión de administradora en la ficha de una mascota sin registro
   para hoy, **When** toca el control de "visto", **Then** el día de hoy queda
   marcado como visto con una sola acción.
2. **Given** un día de hoy ya marcado como "visto", **When** la administradora
   toca el control de "revisado y no estaba", **Then** el registro de hoy pasa
   a ese estado sin crear un segundo registro para el mismo día.
3. **Given** un día de hoy ya marcado, **When** la administradora toca el
   mismo estado por segunda vez (por ejemplo, por un doble toque accidental),
   **Then** el registro sigue siendo uno solo, sin duplicados.
4. **Given** la ficha de una mascota abierta en un celular, **When** la
   administradora usa el control de marcado, **Then** puede completar la
   acción con una sola mano, sin necesitar hacer zoom ni desplazarse por la
   pantalla.

---

### User Story 2 - Ver el calendario mensual de una mascota (Priority: P2)

Cualquier persona que visita la ficha de una mascota ve un calendario del mes
en curso donde cada día muestra si el animal fue visto, si fue revisado y no
estaba, o si no hay registro de ese día — los tres estados se distinguen entre
sí sin depender solo del color. Junto al calendario ve cuántos días fue visto
en el mes en curso y la racha actual de días consecutivos visto. Puede navegar
a meses anteriores para revisar el historial.

**Why this priority**: Es la razón de ser del registro diario — sin esta
vista, marcar el día (User Story 1) no le devuelve ningún valor visible a
quien lo hace ni a quien consulta la ficha.

**Independent Test**: Con una mascota que ya tiene algunos días marcados
(User Story 1) en distintos estados, se puede probar completamente abriendo
su ficha sin sesión, viendo el mes en curso con los tres estados distinguibles,
navegando a un mes anterior con registros y confirmando que el total del mes y
la racha coinciden con los datos cargados.

**Acceptance Scenarios**:

1. **Given** una mascota con días marcados como visto, revisado y no estaba, y
   días sin ningún registro dentro del mes en curso, **When** cualquier
   persona abre su ficha, **Then** el calendario muestra los tres estados de
   forma distinguible entre sí sin depender solo del color.
2. **Given** el calendario del mes en curso, **When** se cuentan los días
   marcados como visto, **Then** el total mostrado junto al calendario
   coincide con esa cantidad.
3. **Given** una racha de días consecutivos marcados como visto interrumpida
   por un día "revisado y no estaba", **When** se calcula la racha actual,
   **Then** la racha mostrada solo cuenta los días vistos posteriores a esa
   interrupción.
4. **Given** una racha de días consecutivos marcados como visto con un día
   "sin registro" en el medio, **When** se calcula la racha actual, **Then**
   ese día sin registro no corta la racha ni se cuenta como parte de ella.
5. **Given** el calendario de una mascota, **When** una persona navega hacia
   meses anteriores, **Then** puede ver los registros de esos meses, pero
   nunca días posteriores a hoy ni anteriores a la fecha de registro de la
   mascota.

---

### User Story 3 - Cargar un día pasado olvidado (Priority: P3)

Una administradora se da cuenta de que se olvidó de marcar un avistamiento de
ayer o de días anteriores. Desde el calendario de la ficha, con conexión,
toca ese día puntual y lo registra como visto o como revisado y no estaba,
sin poder hacer lo mismo con un día futuro. A diferencia del control rápido
del día de hoy (User Story 1 y User Story 5), cargar o corregir un día pasado
requiere conexión: no queda pendiente para sincronizar después.

**Why this priority**: Corrige el caso real de olvido del gesto principal
(User Story 1), pero depende de que el calendario (User Story 2) ya exista
para tener dónde tocar ese día.

**Independent Test**: Con sesión de administradora en el calendario de una
mascota, se puede probar completamente tocando un día pasado sin registro,
marcándolo como visto, confirmando que aparece así en el calendario, e
intentando tocar un día futuro para confirmar que el sistema no lo permite.

**Acceptance Scenarios**:

1. **Given** sesión de administradora viendo el calendario de una mascota,
   **When** toca un día pasado sin registro, **Then** puede marcarlo como
   visto o como revisado y no estaba.
2. **Given** sesión de administradora viendo el calendario, **When** intenta
   registrar un día posterior a hoy, **Then** el sistema no se lo permite.
3. **Given** un día pasado ya registrado, **When** la administradora lo toca
   de nuevo y elige el otro estado, **Then** el registro de ese día se
   reemplaza en vez de duplicarse.

---

### User Story 4 - Consultar la app sin conexión (Priority: P4)

Una administradora está en una zona sin señal. Abre PetDex desde el ícono que
instaló en su celular y puede seguir viendo la cuadrícula, las fichas que ya
había visitado y sus fotos, con un aviso claro de que ese contenido puede
estar desactualizado y desde cuándo.

**Why this priority**: Es condición necesaria para que el marcado sin
conexión (User Story 5) tenga sentido — primero hay que poder abrir la app y
ver algo útil sin señal.

**Independent Test**: Con el celular en modo avión después de haber visitado
la cuadrícula y al menos una ficha con conexión, se puede probar completamente
abriendo la app instalada y confirmando que se sigue viendo ese contenido con
el aviso de desactualización, sin pantalla en blanco ni error de red.

**Acceptance Scenarios**:

1. **Given** la app instalada en el celular y contenido ya visitado con
   conexión, **When** se abre sin conexión, **Then** se sigue viendo la
   cuadrícula, las fichas visitadas y sus fotos.
2. **Given** contenido mostrado sin conexión, **When** la administradora lo
   consulta, **Then** el sistema deja claro que puede estar desactualizado y
   desde cuándo se cargó por última vez.
3. **Given** el celular sin conexión, **When** la administradora intenta abrir
   la ficha de una mascota que nunca visitó, **Then** el sistema lo indica con
   claridad en vez de mostrar una pantalla en blanco o un error de red crudo.

---

### User Story 5 - Marcar un avistamiento sin conexión (Priority: P5)

Una administradora sin señal marca el día de hoy como visto o revisado y no
estaba. El registro queda pendiente, visualmente distinto de uno ya
confirmado, con la fecha del momento en que lo marcó. Al recuperar señal, se
envía solo, sin que tenga que hacer nada más. Si vuelve a marcar el mismo día
varias veces sin conexión, solo se conserva y se envía el último valor. El
total del mes y la racha del calendario reflejan ese día pendiente de
inmediato, sin esperar a que se sincronice.

**Why this priority**: Es la extensión más específica y de mayor esfuerzo de
la feature — depende de que el marcado (User Story 1) y el modo offline
(User Story 4) ya funcionen por separado.

**Independent Test**: Con el celular en modo avión en la ficha de una mascota,
se puede probar completamente marcando el día de hoy, confirmando que se ve
como pendiente, reactivando la conexión y confirmando que el registro pasa a
verse como confirmado sin acción manual.

**Acceptance Scenarios**:

1. **Given** el celular sin conexión en la ficha de una mascota, **When** la
   administradora marca el día de hoy, **Then** el registro queda visible con
   un estado pendiente, distinto del de un avistamiento confirmado.
2. **Given** un avistamiento pendiente marcado sin conexión, **When** el
   celular recupera señal, **Then** el registro se envía automáticamente y
   pasa a verse como confirmado, sin que la administradora tenga que repetir
   la acción.
3. **Given** el celular sin conexión, **When** la administradora marca el
   mismo día de la misma mascota varias veces con estados distintos antes de
   recuperar señal, **Then** al sincronizar solo se conserva el último valor
   marcado.
4. **Given** un avistamiento pendiente marcado sin conexión, **When** se
   confirma el registro correspondiente, **Then** la fecha registrada es la
   del momento en que se marcó, no la del momento en que se sincronizó.
5. **Given** un avistamiento pendiente que falla al sincronizar de forma
   permanente, **When** ocurre esa falla, **Then** el sistema avisa a la
   administradora explicando qué pasó, en vez de descartar el registro en
   silencio, y le ofrece un control para descartarlo; si quiere volver a
   registrar ese día, lo marca de nuevo desde cero.

---

### Edge Cases

- El calendario de una mascota recién registrada, sin ningún día marcado
  todavía: se muestra el mes en curso con todos los días en "sin registro",
  sin errores.
- La administradora abre el calendario de un mes anterior a la fecha de
  registro de la mascota: ese mes no muestra días marcables ni datos, dado que
  la mascota todavía no existía.
- Dos toques rápidos y consecutivos sobre el mismo estado del día de hoy (un
  doble tap accidental): el resultado es un único registro, no dos intentos
  en conflicto.
- La administradora intenta marcar un día futuro directamente desde el
  calendario: el sistema lo rechaza igual que lo rechaza el control rápido del
  día de hoy.
- La administradora sin conexión intenta cargar o corregir un día pasado
  desde el calendario: la acción no está disponible (el control se muestra
  deshabilitado o el intento se rechaza con aviso), a diferencia del control
  rápido del día de hoy, que sí funciona sin conexión.
- La app se abre sin conexión por primera vez en un dispositivo, sin ningún
  contenido cacheado todavía: no hay nada que mostrar y el sistema lo explica
  en vez de simular una respuesta vacía como si fuera un catálogo real.
- Un avistamiento queda pendiente sin conexión y la administradora cierra la
  app antes de recuperar señal: el registro pendiente sigue ahí la próxima vez
  que abre la app, y se sincroniza en cuanto haya señal.
- Se recupera la señal, pero la sincronización de un avistamiento pendiente
  falla por un motivo que no se resuelve reintentando (por ejemplo, la
  mascota fue eliminada mientras el dispositivo estaba sin conexión): se avisa
  a la administradora en vez de descartarlo en silencio ni reintentarlo para
  siempre.
- Dos dispositivos marcan el mismo día de la misma mascota casi al mismo
  tiempo, uno con conexión y otro sincronizando un registro pendiente: gana el
  último valor que efectivamente se guarda en el servidor, igual que con dos
  toques desde el mismo dispositivo.

## Requirements *(mandatory)*

### Functional Requirements

**Calendario de avistamientos**

- **FR-001**: El sistema MUST mostrar, en la ficha de cada mascota, un
  calendario de avistamientos en vista mensual.
- **FR-002**: El sistema MUST permitir navegar el calendario hacia meses
  anteriores.
- **FR-003**: El sistema MUST mostrar, para cada día del calendario, exactamente
  uno de tres estados —visto, revisado y no estaba, sin registro— de forma
  visualmente distinguible entre los tres sin depender únicamente del color.
- **FR-004**: El sistema MUST NOT mostrar como marcables ni con datos los días
  posteriores a la fecha actual.
- **FR-005**: El sistema MUST NOT mostrar como marcables ni con datos los días
  anteriores a la fecha de registro de la mascota.
- **FR-006**: El sistema MUST mostrar, junto al calendario, el total de días
  marcados como "visto" dentro del mes en curso, incluyendo los días
  marcados como visto que todavía están pendientes de sincronizar.
- **FR-007**: El sistema MUST mostrar, junto al calendario, la racha actual de
  días consecutivos marcados como "visto", incluyendo los días pendientes de
  sincronizar en ese cálculo.
- **FR-008**: Un día marcado como "revisado y no estaba" MUST cortar la racha
  actual.
- **FR-009**: Un día "sin registro" MUST NOT cortar la racha actual ni contarse
  como parte de ella.

**Marcado del día**

- **FR-010**: El sistema MUST proveer, en la ficha de cada mascota y solo con
  sesión de administradora, un control para registrar el día de hoy como
  "visto" o como "revisado y no estaba".
- **FR-011**: Ese control MUST poder operarse con una sola acción táctil, sin
  necesitar desplazamiento ni zoom, de forma utilizable con una sola mano.
- **FR-012**: El sistema MUST permitir cambiar el registro del día de hoy
  después de marcado, si se marcó por error.
- **FR-013**: Marcar el mismo día más de una vez MUST NOT crear registros
  duplicados: el nuevo valor reemplaza al anterior.
- **FR-014**: El sistema MUST permitir, desde el calendario, con sesión de
  administradora y con conexión, registrar o corregir un día pasado dentro
  del rango visible (posterior o igual a la fecha de registro de la mascota,
  anterior a hoy). A diferencia del control rápido del día de hoy (FR-010),
  esta acción MUST NOT quedar disponible sin conexión ni encolarse como
  pendiente.
- **FR-015**: El sistema MUST NOT permitir registrar un día posterior a hoy, ni
  desde el control rápido de la ficha ni desde el calendario.

**Funcionamiento sin conexión**

- **FR-016**: La aplicación MUST poder instalarse en el teléfono y abrirse
  desde su ícono como una aplicación independiente.
- **FR-017**: Sin conexión, el sistema MUST mostrar el último contenido que
  alcanzó a cargar —cuadrícula, fichas visitadas y sus fotos— en vez de una
  pantalla en blanco o un error de red.
- **FR-018**: Sin conexión, el sistema MUST indicar con claridad que el
  contenido mostrado puede estar desactualizado, junto con el momento en que
  se cargó por última vez.
- **FR-019**: Un avistamiento marcado sin conexión MUST quedar en un estado
  pendiente, con una apariencia visual distinta de la de un avistamiento ya
  confirmado por el servidor.
- **FR-020**: Un avistamiento pendiente MUST enviarse automáticamente al
  recuperar la conexión, sin que la administradora tenga que repetir la
  acción.
- **FR-021**: La fecha registrada en un avistamiento marcado sin conexión MUST
  ser la del momento en que se marcó, no la del momento en que se sincroniza.
- **FR-022**: Si el mismo día de la misma mascota se marca varias veces sin
  conexión, el sistema MUST conservar y enviar únicamente el último valor
  marcado.
- **FR-023**: Si la sincronización de un avistamiento pendiente falla de forma
  permanente, el sistema MUST avisar a la administradora en vez de descartar
  el registro en silencio, explicando qué pasó.
- **FR-024**: El sistema MUST ofrecer un control para descartar un avistamiento
  pendiente que falló de forma permanente; si la administradora quiere
  volver a intentarlo, MUST hacerlo marcando el día de nuevo desde el control
  correspondiente, no reenviando el registro fallido.

### Key Entities *(include if feature involves data)*

- **Avistamiento** *(ya existe, ahora con calendario y marcado desde la UI)*:
  un registro por mascota y por día, con estado "visto" o "revisado y no
  estaba"; la ausencia de registro para un día es el tercer estado, "sin
  registro", y nunca se crea una fila para representarlo.
- **Avistamiento pendiente**: un avistamiento marcado sin conexión, guardado
  en el dispositivo hasta poder confirmarse contra el servidor; conserva la
  fecha del momento en que se marcó y se muestra con una apariencia distinta
  de un avistamiento confirmado mientras no se sincroniza.
- **Racha**: cantidad de días consecutivos más recientes marcados como
  "visto", contando hacia atrás desde hoy; se interrumpe en el primer día
  "revisado y no estaba" que encuentra, y salta sin cortarse por los días
  "sin registro". Es un valor calculado, no un dato que se guarda aparte.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una administradora marca el avistamiento de hoy de una mascota
  con una sola acción táctil, en menos de 5 segundos desde que abre la ficha,
  sin necesitar desplazarse ni hacer zoom.
- **SC-002**: En el 100% de los días mostrados en el calendario, se puede
  identificar el estado (visto, revisado y no estaba, sin registro) sin
  depender del color, por ejemplo con el celular en modo de alto contraste o
  en una captura en blanco y negro.
- **SC-003**: Cero registros duplicados aparecen para un mismo día de una
  misma mascota, sin importar cuántas veces se lo haya marcado, con o sin
  conexión.
- **SC-004**: El total de días vistos y la racha mostrados junto al calendario
  coinciden con un conteo manual de los registros del mes en el 100% de los
  casos verificados.
- **SC-005**: Una persona que abre la app sin conexión, tras haber navegado el
  catálogo y al menos una ficha con conexión previamente, sigue viendo ese
  contenido en menos de 2 segundos, sin pantalla en blanco.
- **SC-006**: El 100% de los avistamientos marcados sin conexión se sincronizan
  automáticamente al recuperar señal, sin acción manual, salvo los que fallan
  de forma permanente —esos se le avisan a la administradora en el 100% de los
  casos, con la opción de descartarlos, nunca se descartan en silencio.

## Assumptions

- El caché offline se limita al contenido que la propia administradora ya
  visitó en ese dispositivo (cuadrícula y fichas abiertas); esta feature no
  precarga todo el catálogo por adelantado para uso sin conexión.
- Los avistamientos pendientes se guardan localmente en el dispositivo hasta
  poder sincronizarse; si la administradora desinstala la app o borra los
  datos del navegador antes de que sincronicen, esos registros pendientes se
  pierden — es una limitación aceptada del alcance de esta feature, no una
  garantía de persistencia offline indefinida.
- "Falla de forma permanente" es un rechazo explícito del servidor —por
  ejemplo, la mascota fue eliminada mientras el dispositivo estaba sin
  conexión, o la política de la base rechaza el registro—, no la mera
  ausencia de respuesta. Cualquier otro caso (sin conexión, timeout, sin
  respuesta) se trata como falla temporal y el sistema sigue reintentando en
  silencio sin molestar a la administradora, sin un límite de reintentos
  definido en esta feature.
- El proceso de instalación de la PWA (agregar a la pantalla de inicio) sigue
  el comportamiento estándar del navegador o sistema operativo; esta feature
  no construye una pantalla ni un flujo propio para guiar esa instalación.
- El calendario y sus métricas (total del mes, racha) son de lectura pública,
  igual que el resto de la ficha de una mascota — solo el marcado y la
  corrección de días requieren sesión de administradora.
- La racha se calcula siempre respecto de hoy hacia atrás, sin importar qué
  mes esté viendo la administradora en el calendario; no existe una "racha
  del mes anterior" como métrica separada.
