# Feature Specification: Catálogo público

**Feature Branch**: `001-catalogo-publico`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Feature 1 de PetDex: el catálogo público. PetDex es una app para registrar y seguir animales callejeros de un barrio. Esta primera feature cubre únicamente la parte de solo lectura, accesible sin cuenta. La autenticación, la edición y el seguimiento diario son features posteriores y quedan explícitamente fuera de alcance. Pantalla A — Inicio: contador destacado, cuadrícula de tarjetas (foto, nombre, zona), alternador cuadrícula/lista con preferencia recordada, búsqueda por nombre o apodo insensible a mayúsculas y acentos sobre datos ya cargados, filtro por zona, estado vacío y estado sin resultados distintos. Pantalla B — Ficha: URL por slug, foto grande, nombre, apodos, zona, ubicación de referencia, fecha de registro, edad estimada, peso, descripción (campos vacíos omitidos), línea de tiempo de hitos (título, fecha, categoría opcional, nota opcional; de más reciente a más antigua con opción de invertir; puede no tener hitos). Todo público, sin login. Mascota sin foto muestra placeholder. Slug inexistente muestra 404 propio. Fuera de alcance: login, edición, alta de mascotas, calendario de avistamientos, service worker, offline, notificaciones."

## Clarifications

### Session 2026-08-09

- Q: ¿La zona de cada mascota se elige de una lista fija y predefinida de zonas del barrio, o es un texto libre que carga quien administra al registrar la mascota? → A: Lista fija y predefinida de zonas (catálogo conocido del barrio, elegida de un desplegable al registrar).
- Q: ¿La categoría de un hito se elige de un conjunto fijo de categorías predefinidas, o puede ser un texto libre que decide quien administra al cargar el hito? → A: Conjunto fijo y predefinido de categorías.
- Q: El esquema de base de datos ya aplicado guarda `pets.zone` como texto libre, sin catálogo ni restricción a nivel de base — ¿de dónde sale entonces la lista de zonas que ofrece el filtro de esta feature de solo lectura? → A: Se deriva dinámicamente de las zonas que ya tienen mascotas cargadas en los datos (no hay un catálogo separado ni fijo fuera de los datos mismos). Esto reemplaza la lectura literal de la respuesta anterior sobre "lista fija predefinida": esa decisión describe cómo un futuro panel de administración restringiría la carga (fuera de este alcance), pero esta feature no tiene ni necesita una fuente de verdad adicional para el catálogo de zonas — el filtro simplemente refleja los valores distintos presentes en `pets_overview`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explorar el catálogo de mascotas (Priority: P1)

Un visitante del barrio, sin necesidad de crear cuenta ni iniciar sesión, entra
a PetDex y ve de inmediato cuántas mascotas callejeras están registradas y una
cuadrícula con la foto, el nombre y la zona de cada una. Puede alternar entre
ver esa información como cuadrícula de tarjetas o como una lista compacta,
según lo que le resulte más cómodo leer en ese momento, y la próxima vez que
entre la app recuerda cuál eligió.

**Why this priority**: Es el valor mínimo de la feature: sin esta pantalla no
hay catálogo. Un visitante que solo ve el contador y la cuadrícula ya obtiene
valor (saber cuántos animales hay y reconocer alguno por foto/zona), incluso
sin buscar ni entrar a una ficha individual.

**Independent Test**: Se puede probar completamente entrando a la pantalla de
inicio con datos de mascotas ya cargados en la base y verificando que el
contador coincide con la cantidad real, que aparece una tarjeta por mascota, y
que el alternador de vista cambia la presentación y persiste tras recargar la
página.

**Acceptance Scenarios**:

1. **Given** hay mascotas registradas en el sistema, **When** un visitante
   entra a la pantalla de inicio, **Then** ve un contador con el total exacto
   de mascotas y una tarjeta por cada una, con foto, nombre y zona.
2. **Given** el visitante está viendo la cuadrícula, **When** activa el
   alternador de vista de lista compacta, **Then** la misma información se
   presenta en formato de lista y esa preferencia se mantiene si vuelve a
   entrar más tarde desde el mismo dispositivo.
3. **Given** no hay ninguna mascota registrada en el sistema, **When** un
   visitante entra a la pantalla de inicio, **Then** ve un estado vacío que
   comunica que todavía no hay mascotas cargadas (no un estado de "sin
   resultados" ni una cuadrícula en blanco).

---

### User Story 2 - Ver la ficha completa de una mascota (Priority: P2)

Alguien que reconoció a una mascota en la cuadrícula, o que recibió el enlace
directo de una ficha, entra a la página de esa mascota y encuentra toda la
información pública disponible sobre ella: su foto grande, sus nombres y
apodos, dónde suele estar, cuándo fue registrada, una estimación de su edad y
peso, una descripción, y la historia de hitos que se le fueron registrando a
lo largo del tiempo.

**Why this priority**: Es la segunda pieza de valor central — convierte una
tarjeta anónima en una ficha con contexto — pero depende de que existan
mascotas para mostrar, por lo que se prioriza después de la exploración
general. Es independiente de la búsqueda y el filtrado de la Pantalla A.

**Independent Test**: Se puede probar completamente accediendo de forma
directa a la URL de una mascota existente (sin pasar por la cuadrícula) y
verificando que se muestran los campos con datos y se omiten los campos sin
datos, y que la línea de tiempo de hitos se lista correctamente incluso
cuando la mascota no tiene ningún hito.

**Acceptance Scenarios**:

1. **Given** una mascota con todos sus campos opcionales cargados, **When** se
   visita su ficha, **Then** se muestran foto grande, nombre, apodos, zona,
   ubicación de referencia, fecha de registro, edad estimada, peso y
   descripción.
2. **Given** una mascota con algunos campos opcionales vacíos (por ejemplo sin
   apodos ni peso), **When** se visita su ficha, **Then** esos campos no
   aparecen en la página en ninguna forma, ni siquiera como "sin datos".
3. **Given** una mascota con varios hitos cargados en distintas fechas,
   **When** se visita su ficha, **Then** los hitos se listan del más reciente
   al más antiguo por defecto, y el visitante puede invertir el orden para
   verlos del más antiguo al más reciente.
4. **Given** una mascota sin ningún hito cargado, **When** se visita su ficha,
   **Then** la línea de tiempo se muestra vacía de forma clara, sin error ni
   espacio roto.
5. **Given** una mascota sin foto cargada, **When** se visita su ficha o se la
   ve en la cuadrícula, **Then** se muestra una imagen de placeholder en lugar
   de un ícono de imagen rota.
6. **Given** un slug que no corresponde a ninguna mascota existente, **When**
   se visita esa URL, **Then** se muestra una página 404 propia de PetDex, no
   la página de error genérica de Next.js.

---

### User Story 3 - Buscar y filtrar dentro del catálogo (Priority: P3)

Un visitante que ya sabe el nombre o apodo de la mascota que busca, o que solo
quiere ver las mascotas de su propia zona, escribe en el buscador o elige una
zona en el filtro, y la cuadrícula se actualiza al instante para mostrar solo
las coincidencias, sin que la página recargue ni haga esperar una respuesta
del servidor.

**Why this priority**: Mejora sustancialmente la experiencia sobre un barrio
con muchas mascotas registradas, pero el catálogo ya es útil sin ella (User
Story 1); por eso queda en tercer lugar.

**Independent Test**: Se puede probar completamente con el catálogo ya
cargado, tipeando en el buscador un nombre o apodo existente con mayúsculas o
acentos distintos a como está guardado y verificando que igual aparece, y
luego tipeando un texto que no coincide con nada y verificando que aparece un
estado de "sin resultados" distinto al estado vacío general.

**Acceptance Scenarios**:

1. **Given** el catálogo tiene una mascota llamada "Ñandú", **When** el
   visitante busca "nandu" (sin ñ, sin acento, en minúsculas), **Then** esa
   mascota aparece igual en los resultados.
2. **Given** el visitante ya tipeó una búsqueda, **When** agrega o borra
   caracteres, **Then** los resultados se actualizan al instante sin recargar
   la página ni mostrar un estado de carga de red.
3. **Given** hay mascotas registradas, **When** el visitante busca un texto
   que no coincide con ningún nombre ni apodo, **Then** ve un estado de "sin
   resultados" que es visualmente y textualmente distinto del estado vacío
   que se muestra cuando no hay mascotas en absoluto.
4. **Given** el visitante elige una zona en el filtro, **When** la búsqueda
   por texto está activa al mismo tiempo, **Then** la cuadrícula muestra solo
   las mascotas que cumplen ambas condiciones a la vez.

### Edge Cases

- Una mascota tiene nombre pero ningún apodo: el apodo no se muestra ni en la
  ficha ni genera un espacio vacío.
- El filtro de zona se limpia (se vuelve a "todas las zonas") mientras hay una
  búsqueda de texto activa: la búsqueda de texto se sigue aplicando sola.
- Se borra completamente el texto del buscador: el catálogo vuelve a mostrar
  todas las mascotas (sujetas al filtro de zona si hay uno activo).
- Una mascota tiene un hito con fecha futura o igual a la fecha de registro:
  igual se lista en la línea de tiempo en su posición cronológica correcta.
- Se accede a la ficha de una mascota por una URL con el slug mal escrito o en
  mayúsculas: se trata como slug inexistente y muestra el 404 propio.
- Dos mascotas terminan con el mismo nombre: cada una tiene su propio slug
  único, por lo que sus URLs no chocan (el mecanismo de generación de slugs
  únicos es responsabilidad de la feature de alta, fuera de este alcance).

## Requirements *(mandatory)*

### Functional Requirements

**Pantalla A — Inicio**

- **FR-001**: El sistema MUST mostrar, sin requerir sesión iniciada, un
  contador con la cantidad total de mascotas registradas.
- **FR-002**: El sistema MUST mostrar una cuadrícula con una tarjeta por
  mascota registrada, incluyendo foto, nombre y zona.
- **FR-003**: El sistema MUST permitir alternar entre una vista de cuadrícula
  y una vista de lista compacta con la misma información.
- **FR-004**: El sistema MUST recordar la preferencia de vista (cuadrícula o
  lista) del visitante entre visitas desde el mismo dispositivo.
- **FR-005**: El sistema MUST permitir buscar mascotas por nombre o apodo, sin
  distinguir mayúsculas de minúsculas ni considerar los acentos como
  distintivos.
- **FR-006**: El sistema MUST aplicar la búsqueda sobre los datos ya cargados
  en el navegador, actualizando resultados sin generar una consulta nueva a
  la base de datos por cada tecla presionada.
- **FR-007**: El sistema MUST permitir filtrar el catálogo por zona, ofreciendo como opciones las zonas que efectivamente tienen al menos una mascota registrada (derivadas de los datos, sin catálogo separado).
- **FR-008**: El sistema MUST combinar la búsqueda por texto y el filtro de
  zona cuando ambos están activos, mostrando solo mascotas que cumplan las dos
  condiciones.
- **FR-009**: El sistema MUST mostrar un estado vacío específico cuando no hay
  ninguna mascota registrada en el sistema.
- **FR-010**: El sistema MUST mostrar un estado de "sin resultados" específico
  —distinto del estado vacío— cuando la búsqueda o el filtro activo no
  encuentran ninguna coincidencia.

**Pantalla B — Ficha de la mascota**

- **FR-011**: El sistema MUST exponer cada mascota en una URL propia y legible
  basada en un slug.
- **FR-012**: El sistema MUST mostrar en la ficha, cuando tengan valor: foto
  grande, nombre, apodos, zona, ubicación de referencia, fecha de registro,
  edad estimada, peso y descripción.
- **FR-013**: El sistema MUST omitir por completo de la interfaz cualquier
  campo opcional que no tenga valor cargado, sin mostrar textos como "sin
  datos" en su lugar.
- **FR-014**: El sistema MUST mostrar una línea de tiempo con los hitos de la
  mascota (título y fecha obligatorios; categoría —elegida de un conjunto
  fijo y predefinido, no texto libre— y nota, ambas opcionales), ordenada de
  más reciente a más antigua por defecto.
- **FR-015**: El sistema MUST permitir invertir el orden de la línea de
  tiempo para verla de más antigua a más reciente.
- **FR-016**: El sistema MUST mostrar correctamente la ficha de una mascota
  que no tiene ningún hito cargado, sin error y sin tratarlo como un caso
  distinto del resto de la ficha.
- **FR-017**: El sistema MUST responder con una página 404 propia de PetDex
  —no la página de error genérica del framework— cuando se visita un slug
  que no corresponde a ninguna mascota existente.

**Transversales**

- **FR-018**: El sistema MUST mostrar toda la información de esta feature sin
  requerir cuenta ni sesión iniciada.
- **FR-019**: El sistema MUST mostrar una imagen de placeholder en lugar de
  una imagen rota para cualquier mascota (en cuadrícula, lista o ficha) que no
  tenga foto cargada.

### Key Entities *(include if feature involves data)*

- **Mascota**: un animal callejero registrado. Atributos relevantes para esta
  feature: nombre, apodos (cero o más), zona, ubicación de referencia
  (opcional), fecha de registro, edad estimada (opcional), peso (opcional),
  descripción (opcional), foto (opcional), slug único usado en la URL de su
  ficha. Es de solo lectura en esta feature: el alta y la edición pertenecen
  a una feature posterior.
- **Hito**: una nota fechada dentro de la historia de una mascota. Atributos:
  título, fecha, categoría (opcional, elegida de un conjunto fijo y
  predefinido de categorías), nota (opcional). Pertenece a una única mascota;
  una mascota puede tener cero o muchos hitos. Es de solo lectura en esta
  feature.
- **Zona**: el valor de zona de una mascota existente. Para esta feature de
  solo lectura, el conjunto de zonas que ofrece el filtro se deriva de las
  zonas que efectivamente tienen mascotas registradas, no de un catálogo
  separado. Cómo se restringe la carga de zona al registrar una mascota es
  una decisión de la feature de alta/administración, fuera de este alcance.
- **Preferencia de vista**: la elección del visitante entre cuadrícula y
  lista compacta. Se guarda por dispositivo/navegador, no por cuenta, ya que
  esta feature no tiene cuentas de usuario final.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El contador de la pantalla de inicio coincide exactamente con
  la cantidad de mascotas registradas en el 100% de los casos, incluyendo
  cero mascotas.
- **SC-002**: El 100% de las mascotas registradas aparecen en la cuadrícula
  con una imagen visible (propia o placeholder) — cero casos de imagen rota.
- **SC-003**: Un visitante puede encontrar una mascota conocida por nombre o
  apodo escribiendo el texto sin importar mayúsculas ni acentos, y ve los
  resultados actualizarse sin ninguna espera perceptible de red.
- **SC-004**: Un visitante puede pasar de la cuadrícula a la ficha completa de
  cualquier mascota visible y ver ahí toda la información cargada para esa
  mascota, sin campos en blanco ni textos de relleno tipo "sin datos".
- **SC-005**: Visitar la URL de una mascota que no existe siempre resulta en
  una página de error identificable como parte de PetDex, nunca en la página
  de error genérica del framework.
- **SC-006**: Un visitante que elige la vista de lista compacta la vuelve a
  ver en su próxima visita desde el mismo dispositivo, sin tener que
  volver a elegirla.
- **SC-007**: Un visitante puede distinguir, con solo mirar la pantalla, entre
  "todavía no hay mascotas registradas" y "tu búsqueda no encontró nada".

## Assumptions

- Login, edición de mascotas, alta de mascotas, calendario de avistamientos,
  funcionamiento offline y notificaciones quedan fuera de esta feature; se
  abordan en features posteriores y no se implementan aquí.
- La cuadrícula, en ausencia de búsqueda o filtro, se ordena por fecha de
  registro de más reciente a más antigua; no se especificó un orden distinto.
- El filtro de zona es de selección única (una zona a la vez, o "todas");
  esto es consistente con el uso principal de una sola mano en la calle.
- No hay paginación en esta primera versión: se asume un volumen de mascotas
  de barrio (decenas, no miles) que la cuadrícula puede mostrar completa.
- El slug de cada mascota ya existe en los datos al momento de esta feature
  (se genera en la feature de alta); esta feature no genera ni valida slugs,
  solo los resuelve para mostrar la ficha correspondiente.
- La compresión de fotos y el uso de URLs públicas permanentes ya están
  garantizados por cómo se cargan las fotos en la feature de alta; esta
  feature consume `pets.photo_url` tal cual y solo agrega el placeholder para
  el caso sin foto.
- El catálogo público muestra todas las mascotas registradas sin filtrar por
  su estado interno (activa, sin ver, adoptada, fallecida): esta feature no
  distingue ni excluye por estado. Curar qué se muestra según estado es una
  decisión de una feature posterior (panel de administración / flujo de
  adopciones), fuera de este alcance.
