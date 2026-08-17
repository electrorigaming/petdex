# Handoff: PetDex — rediseño de UI sobre Nocturne

## Overview

Rediseño completo de la interfaz de **PetDex**, el registro web de mascotas comunitarias
callejeras (Next.js + Supabase, alcance v1 según `referencia/CURRENT_STATE.md`).
No cambia ninguna función ni ninguna ruta: son las mismas pantallas, el mismo modelo de
datos y las mismas reglas de autorización, redibujadas sobre el sistema de diseño
**Nocturne** (interfaz oscura, acento blurple, Inter, escala compacta) y con cinco
refinamientos concretos a problemas ya identificados (marcados `△` más abajo).

Cambio de dirección visual respecto de lo que hay hoy en producción: el sistema anterior
era Swiss/minimal claro con acento `#2563EB`. Nocturne es oscuro, con **botones
delineados (nunca rellenos)**, reglas que se desvanecen en las puntas, y el acento usado
como línea y marca, nunca como fondo grande.

## About the Design Files

Los archivos de `mockups/` son **referencias de diseño hechas en HTML** — prototipos que
muestran el aspecto y el comportamiento buscados, **no código para copiar y pegar**.
La tarea es **recrear estos diseños dentro del codebase existente de PetDex**
(Next.js App Router + React + Tailwind + shadcn/ui) usando sus patrones ya establecidos:
los mismos componentes (`<PetGrid>`, `<PetCard>`, `<PetDetail>`, `<SightingCalendar>`,
`<DayCell>`, `<PetForm>`…), la misma estructura de rutas, la misma capa de datos.

Lo que sí hay que reescribir es la capa de estilo: tokens, paleta, tipografía y las
primitivas de `src/components/ui/`.

Para abrir el mockup: `mockups/PetDex Mockups.dc.html` en un navegador (necesita
`nocturne.css` y `support.js` al lado, y conexión para las fuentes Inter y los íconos
Phosphor). Se puede hacer zoom/pan libremente sobre el lienzo.

## Fidelity

**Alta fidelidad.** Colores, tipografía, espaciados, radios e iconografía son finales y
están tomados de los tokens de Nocturne. Reproducir tal cual, salvo donde este README
diga explícitamente "a criterio".

Cada pantalla tiene un id estable (`1a` … `1n`) visible en el mockup; se usan en este
documento para referirse a ella.

---

## Design tokens

Fuente de verdad: `mockups/nocturne.css` (copiarlo o traducir sus `:root` a los tokens de
Tailwind / CSS vars del proyecto). **Nunca hardcodear un hex que ya esté acá.**

### Color

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#161826` | Fondo de toda la app |
| `--color-surface` | `#232532` | Cards, inputs, superficies elevadas |
| `--color-text` | `#e9e9ed` | Texto principal |
| `--color-accent` | `#9184d9` | Acento único (bordes, íconos, marcas) |
| `--color-divider` | `color-mix(in srgb, #e9e9ed 16%, transparent)` | Bordes y reglas |
| `--color-neutral-100…900` | `#f3f5fe` … `#292b31` | Rampa neutra |
| `--color-accent-100…900` | `#f5f4ff` … `#2b2741` | Rampa de acento |

Valores puntuales usados en los mockups (todos salen de las rampas):
`#1e2030` (fondo hundido: banners, franjas, placeholders de foto),
`#1b1d2b` (paneles de agrupación), `#12131f`/`#101120` (fondo detrás de un diálogo),
`#3f424d` = `neutral-800` (bordes punteados), `#595d6c` = `neutral-700` (íconos apagados),
`#75798c` = `neutral-600` (texto terciario), `#9397ab` = `neutral-500` (texto secundario),
`#b2b6ca` = `neutral-400`, `#cfd3e5` = `neutral-300`,
`#423a6a` = `accent-800` (relleno de la celda "vista"), `#b5abfc` = `accent-400`,
`#d2cefd` = `accent-300` (texto sobre relleno de acento).

**Reglas duras del sistema:** nada de negro ni blanco puros; nada de rellenos saturados
grandes (el acento vive en líneas y marcas chicas); no hay color de peligro — el rojo no
existe en esta paleta.

### Tipografía

Inter (400 / 500), `--font-heading` = `--font-body`. **Los títulos nunca pasan de peso 500** —
la jerarquía la dan tamaño y espacio.

`h1 42px` · `h2 32px` · `h3 25px` · `h4 20px` · `h5 16px` · `h6 13px` (uppercase, tracking `.08em`),
todos con `line-height 1.12` y `letter-spacing -0.015em`. Cuerpo: `15px / 1.55`.
Escala menor usada en la UI: `14px` (botones e inputs), `13px` (meta), `12px` (labels),
`11px` (leyendas, tags), `10px` (kickers, números de día).

En mobile los inputs suben a `16px` (evita el zoom de iOS) y sus alturas a `44px`.

### Espaciado, radio, elevación

Escala 0.7×: `--space-1 2.8px`, `-2 5.6px`, `-3 8.4px`, `-4 11.2px`, `-6 16.8px`, `-8 22.4px`.
Radios: `--radius-sm 4px`, `--radius-md 8px`, `--radius-lg 14px`.
Sombras: `--shadow-sm/md/lg` (hairline + oscuridad ambiente). No apilar sombras.

### Iconografía

**Phosphor** (`@phosphor-icons/web`), peso *regular* salvo donde se indique.
Íconos usados: `paw-print` (fill, marca), `magnifying-glass`, `map-pin`, `plus`, `check`
(**bold** dentro de la celda del calendario), `x`, `caret-left/right`, `pencil-simple`,
`trash`, `arrows-down-up`, `image-square`, `camera`, `wifi-slash`, `wifi-high`,
`arrow-clockwise`, `warning`, `warning-circle`, `check-circle`, `sign-out`, `google-logo`,
`prohibit`, `squares-four`, `rows`.
Nota: `ph-fill ph-check` **no** es un tilde (sale un bloque macizo) — usar `ph-bold ph-check`.

### Estados de interacción (no dejar los del navegador)

- `:focus-visible` → `outline: 2px solid var(--color-accent); outline-offset: 2px`.
- Hover de botón delineado → `background: color-mix(in srgb, var(--color-accent) 12%, transparent)`;
  activo → 22%. Secundario/ghost: mismas mezclas sobre `--color-text` al 7% / 14%.
- Deshabilitado → `opacity .45`.
- `::selection` → acento al 30%.

Todo esto ya está resuelto en `nocturne.css` (`.btn`, `.input`, `.seg`, `.radio`, `.card`,
`.tag`, `.table`, `.dialog`, `.nav`). **Portar esas clases a las primitivas de
`src/components/ui/` en vez de restilar cada pantalla.**

---

## Mapa de componentes: mockup → codebase

| Mockup | Componente actual | Qué cambia |
|---|---|---|
| `1a` `1b` `1c` | `<PetGrid>`, `<ViewToggle>`, `<AddPetButton>` | Contador + toolbar reordenados; la vista lista pasa a `.table` en desktop |
| `1d` | `<PetCard>` | Tres variantes a elegir (ver abajo) |
| `1e` | header de `app/layout.tsx`, `<SessionNavLink>` | Tres variantes a elegir |
| `1f` `1g` | `<PetDetail>`, `<PetSightingsSection>`, `<MilestoneTimeline>` | Desktop pasa a 2 columnas; acciones admin unificadas |
| `1f` `1g` | `<SightingCalendar>`, `<DayCell>`, `<MonthSummary>` | `△` Celda rediseñada |
| `1g` | `<MarkTodayControl>` | Dos botones de 48px, uno primario y uno secundario |
| `1h` `1i` | `<PetForm>`, `<PhotoField>`, `<SlugField>` | Grilla de 2 columnas en desktop; foto a la derecha |
| `1j` | `<MilestoneForm>` | Categoría pasa de `<Select>` a chips de radio |
| `1k` | `<DeletePetButton>`, `<DeleteMilestoneDialog>` | `△` Un solo patrón + franja Deshacer (nueva) |
| `1l` | `<PastDayDialog>` | `△` Dos entradas, un diálogo |
| `1m` | `<LoginButton>`, `<NotAdminScreen>` | Copy nuevo, layout flush-left |
| `1n` | `<EmptyState>`, `<NoResultsState>`, `/offline`, los tres banners | `△` Figura común de estado vacío |

---

## Screens

### `1a` Catálogo — mobile 375, visitante

**Layout:** header (`.nav`, 11/17px de padding) → contenido con padding lateral `17px`,
columna `gap 17px`.

- **Contador:** número `38px/1`, peso 500, `letter-spacing -.02em`; debajo, "mascotas en
  el registro" `13px` en `#9397ab`.
- **Buscador:** ya no está en el cuerpo — vive en el header (variante B, ver `1e`): segunda
  fila del header, `.input` de `40px`, `padding-left 32px`, ícono `magnifying-glass` de `15px`
  absoluto, color `#75798c`, y debajo la regla que se desvanece.
- **Fila de filtros:** `<select>` de zona (`flex:1`, 42px) + `.seg` de dos opciones icon-only
  (`squares-four` / `rows`). El select de zona solo aparece si hay más de una zona con
  mascotas (regla actual, se mantiene).
- **Grilla:** 2 columnas, `gap 11px`. Card = **variante B** (elegida): retrato
  `aspect-ratio 4/5`, nombre `15px/500` y zona `12px` `#cfd3e5` sobre un degradado
  (`linear-gradient(to top,#12131f 14%,rgba(18,19,31,.72) 58%,transparent)`, `padding 30px 10px 10px`),
  y tag de estado arriba a la izquierda (`.tag-accent` "Hoy" / `.tag-neutral` "Ayer"; sin tag
  si hace más de un par de días). Toda la card es un `<Link>`.
- **Placeholder de foto:** `repeating-linear-gradient(135deg,#232532 0 6px,#1e2030 6px 12px)`.
  Si la mascota **no tiene** foto: fondo liso `#1e2030` + `image-square` de `22px` en `#3f424d`
  (el degradado y el nombre se mantienen igual).
- **Sesión visitante:** en el header, link "Iniciar sesión". Sin botón Agregar.

### `1b` Catálogo — mobile 375, admin y sin conexión

Igual a `1a` más:
- **Header admin:** marca + `btn-icon btn-primary` (`plus`) + `btn-icon btn-secondary`
  (`sign-out`) en la primera fila; buscador en la segunda. En 375 las acciones van solo con
  ícono para no comerse el ancho.
- **Contador contextual:** con búsqueda o zona activa, el número grande pasa a ser la cantidad
  de resultados ("2 · resultados para 'lun' en Plaza Mitre") en vez del total del registro.
- **OfflineBanner:** franja de `7px 17px`, fondo `#1e2030`, `wifi-slash` en acento + texto
  `12px`: "Sin conexión — datos de las 9:12". Va **debajo del header**, ancho completo.
- **Vista lista en mobile:** filas de `.card` horizontales, thumb `52px` radio `6px`,
  nombre + "apodo · zona" en `12px`, y a la derecha el estado del último avistamiento
  (`check-circle` + "hoy" en `#b5abfc`, o "hace 4 días" en `#75798c`).
- Header con "Salir" (`.btn.btn-ghost` + `sign-out`).

### `1c` Catálogo — desktop 1440, admin, vista lista

- Contenido con padding `28px 56px 44px`, ancho máximo de columna `1040px`, **flush-left**
  (el aire queda a la derecha — es la dirección del sistema).
- **Header (variante B):** marca + buscador de `34px` (máx. `380px`) + "Agregar mascota"
  (primario, empujado con `margin-left:auto`) + mail de la cuenta + `btn-icon` de salir;
  debajo, la regla que se desvanece.
- **Encabezado:** contador `46px` en línea con "27 mascotas en el registro · 19 vistas esta
  semana" (`15px`, `#9397ab`).
- **Toolbar:** select de zona (`190px`) + `.seg` con etiquetas ("Cuadrícula" / "Lista")
  empujado a la derecha con `margin-left:auto`. El buscador ya no está acá.
- **Tabla `.table`:** columnas Mascota (46%) / Zona / Último avistamiento / Racha (derecha).
  Las reglas de fila se desvanecen 48px en cada punta — ya resuelto en la clase.
  Celda Mascota: thumb `40px` + nombre `500` + apodo `12px` `#75798c`.
- Header con el mail de la cuenta (`13px`, `#75798c`) y "Cerrar sesión".

### `1d` PetCard — variante **B** (elegida)

- **A · sobria** — foto `3:2` arriba, texto abajo. Es la actual, ordenada. Ancho de card
  libre; en grilla mobile de 2 columnas mide ~163px.
- **B · foto protagonista ✓ elegida** — retrato `4:5`, nombre y zona sobre un degradado
  (`linear-gradient(to top,#12131f 12%,rgba(18,19,31,.7) 55%,transparent)`, `padding 34px 11px 11px`),
  tag de estado arriba a la izquierda. Exige buenas fotos de todas las mascotas.
- **C · fila de lista** — thumb `48px`, nombre + "apodo · zona", y a la derecha **el dato
  nuevo**: cuándo se la vio por última vez. Recomendada para la vista lista.

**Decidido:** B para la cuadrícula. Implica que **la foto es obligatoria en la práctica**: sin
foto la card sigue funcionando (fondo `#1e2030` + `image-square`), pero conviene empujar la
carga de foto en el alta. La vista **lista** mantiene la fila C — B es un tratamiento de card,
no de fila.

### `1e` Header — variante **B** (elegida)

- **A · mínima** — marca + sesión. Debajo, la regla que se desvanece
  (`linear-gradient(to right,transparent,var(--color-divider) 48px,var(--color-divider) calc(100% - 48px),transparent)`, 1px).
- **B · con buscador ✓ elegida** — desktop: marca + `.input` de `34px` (máx. 380px) +
  "Agregar mascota" + mail + botón icon-only de salir, con la regla desvanecida debajo.
  **En 375** el header toma dos filas: marca + acciones icon-only arriba, buscador de `40px`
  ancho completo abajo. El buscador desaparece del cuerpo del catálogo en los dos tamaños.
  En la ficha (`1g`) el header es el mismo; en mobile la ficha conserva "volver" y no lleva
  buscador.
- **C · contextual (mobile)** — marca + tag de la zona filtrada + acciones icon-only
  (`btn-icon`, 36px).

La marca es siempre `paw-print` (fill, acento, `19–20px`) + "PetDex" en `18–19px` peso 500.

### `1f` Ficha — mobile 375, visitante (calendario en solo lectura)

Orden: volver → foto `3:2` (radio 8) → nombre `h3` + apodos `14px` `#9397ab` → tags
(zona con `map-pin` + estado `.tag-outline`) → grilla 2×2 de datos (label `11px` uppercase
`#75798c` + valor `15px`; **solo los campos con valor**) → descripción `15px/1.6` con
`text-wrap:pretty` → regla → **Avistamientos** → regla → **Hitos**.

- **Navegación de mes:** `caret-left` / "agosto 2026" (`13px`, ancho mínimo 88px, centrado) /
  `caret-right` deshabilitado si el mes es el actual. Acotada a `[registered_on, hoy]`.
- **Calendario:** grilla de 7 columnas, `gap 2px`, cabecera `L M M J V S D` en `10px`.
- **Celda (`△` rediseñada):** alto `46px`, columna centrada `gap 3px`:
  el **número del día arriba** (`10px`, `#75798c`) y **la marca abajo** (círculo de `24px`):
  - *vista* → relleno `#423a6a`, borde `1px solid #9184d9`, `check` **bold** de `11px` en `#d2cefd`;
  - *revisada y no estaba* → sin relleno, borde `1px solid #595d6c`, `x` de `11px` en `#9397ab`;
  - *sin registro* → borde `1px dashed #3f424d`, sin ícono;
  - *futuro / fuera de rango* → hueco vacío de `24px` (solo el número, sin círculo);
  - *pendiente de sincronizar* → punto de `8px` de acento con halo `0 0 0 2px #161826`,
    absoluto arriba a la derecha de la celda. **Reemplaza al badge de reloj superpuesto.**
- **Leyenda** debajo (`11px`): los cuatro casos con su marca en `14px`.
- **MonthSummary:** dos números de `30px/1` ("18 vistas este mes", "5 días racha actual"),
  lado a lado con `gap 28px`.
- **Hitos (solo lectura):** cards con fecha `12px` `#75798c`, `.tag` de categoría a la
  derecha, título `15px/500` y nota `13px` `#9397ab`. Botón "Invertir" en ghost.
- El visitante **no ve** el control de marcado ni "Corregir otro día".

### `1g` Ficha — desktop 1440, admin

Grilla `472px / 1fr` con `gap 56px`, ancho máximo `1180px`, alineada a la izquierda.

- **Columna izquierda:** fila de acciones alineada a la derecha (ver `△` abajo) → foto `3:2`
  (envuelta en `.lighten`) → `h2` + apodos → tags → datos 2×2 → descripción (`max-width 44ch`).
- **Columna derecha:** marcado → calendario → resumen + "Corregir otro día…" → hitos.
- **MarkTodayControl:** dos botones de **48px** al 50% cada uno — "Vista hoy"
  (`.btn-primary`, `check`) y "Pasé y no estaba" (`.btn-secondary`, `x`). Debajo, si hay
  cola offline: punto de acento de `8px` + "Marcada hoy sin conexión — se sincroniza sola
  cuando vuelva la señal."
- **Calendario desktop:** mismas reglas que `1f` con celda de `58px` (radio 8) y marca de
  `28px`; `gap 4px`; cabecera `lun mar mié…`; ancho máximo `560px`.
- **Resumen:** números de `34px`, `gap 36px`; a la derecha, "Corregir otro día…" en ghost
  con `pencil-simple`.
- **Hitos:** "Invertir orden" (ghost) + "Agregar hito" (secundario); cada card con
  `pencil-simple` y `trash` icon-only ghost de `30px` a la derecha.

**`△` Patrón único de acciones destructivas.** En la ficha: "Editar" en ghost con
`pencil-simple`, un separador vertical de `1px × 18px` (`#3f424d`, márgenes de 6px), y
"Eliminar" como **icon-only ghost**. Es el mismo patrón que ya usan los hitos — antes la
ficha usaba dos `outline` iguales. Como la paleta es monocroma, la jerarquía la dan el
ícono, el aislamiento y el diálogo de confirmación, nunca un color de peligro.

### `1h` PetForm — desktop (área de contenido 1040)

Grilla `1fr / 320px`, `gap 40px`. Izquierda los campos, derecha la foto.

Orden de campos: Nombre + Apodos (2 col) · Dirección de la ficha · Zona + Ubicación exacta
(2 col) · En el registro desde + Edad estimada + Peso (3 col) · Estado (4 radios en fila) ·
Descripción (textarea, `min-height 90px`).

- **SlugField:** prefijo `petdex.app/mascotas/` como bloque `#1e2030` pegado al input
  (radio `8px 0 0 8px`, sin borde derecho), input en monoespaciada `13px`.
- **PhotoField:** dropzone `3:2` con borde `1px dashed #3f424d` y el placeholder rayado;
  ícono `image-square 26px`, "Arrastrá una foto o [elegí un archivo]" y, en monoespaciada
  `10px`, "se comprime a 1600px · webp". Subiendo: franja `#1e2030` con `arrow-clockwise`,
  "Subiendo foto…" y el porcentaje, más una barra de `3px` con relleno de acento.
- **Pie:** regla que se desvanece + "Cancelar" (secundario) y "Guardar cambios" (primario)
  alineados a la derecha.

### `1i` PetForm — mobile 375 (alta)

Una columna, campos de `44px` con texto de `16px`. Header con "Cancelar" (`x`) a la
izquierda y "Guardar" (primario) a la derecha; abajo, "Agregar al registro" en
`.btn-block` de `48px`. La foto arriba de todo como dropzone `3:2` con `camera`.
Placeholders con voz de barrio: "Cómo le dicen en el barrio", "Cómo reconocerla, dónde
duerme, si se deja acercar…".

### `1j` MilestoneForm — mobile 375

Título · Fecha (`type=date`) · **Categoría como chips de radio** (`8px 14px`, radio 8, el
activo con borde y texto de acento) en vez de un select · Nota (opcional). Botón de
`48px` y nota al pie: "Los hitos son públicos: los ve cualquiera que abra la ficha."

### `1k` Diálogos destructivos `△`

`.dialog` de `440px` (mascota) y `380px` (hito), sobre backdrop oscuro.
Estructura fija: ícono `trash` (`18–20px`, `#b5abfc`) + título · cuerpo con **consecuencias
concretas y contadas** ("Se borran también sus 14 hitos y sus 96 avistamientos. No se puede
deshacer desde la app.") · acciones a la derecha: "Cancelar" (secundario) y confirmar
(primario, delineado de acento).

**Va (decidido):** franja de **Deshacer** tras el borrado — `#1e2030`, radio 8, `check-circle` de
acento, "Se eliminó a Luna.", botón ghost "Deshacer" y una `x` para descartar. Propuesta:
15 s de ventana, borrado real diferido o restauración desde una copia en memoria. Es la
única red de seguridad post-borrado. Implementación sugerida: borrado real diferido 15 s en el
cliente con `setTimeout` cancelable, o borrado inmediato + `restore` desde un snapshot en
memoria (mascota + hitos + avistamientos) si el usuario deshace.

### `1l` Corregir un día pasado `△`

**Un solo diálogo, dos entradas.**
- Desde una celda del calendario → título con la fecha ("Jueves 6 de agosto"), cuerpo
  "Sin registro. ¿Qué pasó ese día?", dos botones de `44px` ("La vi" / "Pasé y no estaba"),
  y la nota "Corregir días pasados requiere conexión" con `wifi-high`.
- Desde el botón "Corregir otro día…" → **el mismo diálogo** más un campo `type=date`
  acotado a `[registered_on, ayer]`. Si el día ya tiene registro, aviso inline en
  `#b5abfc`: "Ese día ya figura como 'vista'. Guardar lo reemplaza."
- **Affordance unificada:** al hacer hover (o mantener apretado en mobile) sobre un día
  pasado, su círculo punteado toma el borde de acento y muestra `pencil-simple` — el mismo
  ícono del botón. Así los dos caminos se leen como la misma acción.

### `1m` Login y cuenta sin acceso — mobile 375

- **Login:** marca + `h4` "Entrar para editar" + párrafo que aclara que **mirar no necesita
  cuenta** + "Continuar con Google" (`.btn-secondary.btn-block`, 48px, `google-logo`) +
  link "Volver al registro". Contenido centrado verticalmente, **texto flush-left**.
- **Cuenta bloqueada:** círculo punteado de `56px` con `prohibit` → "Esta cuenta no tiene
  acceso" → párrafo con el mail en `#cfd3e5` → "Cerrar sesión" (secundario) + "Ver el
  registro" (ghost). Se muestra en **cualquier ruta** para una sesión no-admin.

### `1n` Estados vacíos, /offline y avisos `△`

**Figura común de estado vacío:** círculo `72px` con borde `1px dashed #3f424d`, ícono de
`28–30px` en `#595d6c`, título `17px/500`, una línea de explicación `13px` `#9397ab`, y
**como mucho una acción**. Es la misma forma que el círculo "sin registro" del calendario,
así que el vocabulario cierra.

- *Registro vacío* → `paw-print` · "Todavía no hay ninguna mascota" · "Empezá por la que más
  ves: nombre, zona y una foto alcanzan." · "Agregar la primera" (primario, solo admin).
- *Sin resultados* → `magnifying-glass` · "Nada con 'lunita'" (la consulta, entre comillas) ·
  "Probá con un apodo, o mirá todas las zonas." · "Limpiar filtros" (ghost).
- */offline* → `wifi-slash` · "Esta página no está guardada" · "Sin conexión solo podés abrir
  lo que ya visitaste. Volvé a intentar cuando tengas señal." · sin acción.

**Banners** (franjas de una línea, `9px 14px`, radio 8):
- Offline → `#1e2030`, `wifi-slash` en acento: "Sin conexión — mostrando datos de las 9:12".
- Actualización → **`#2b2741` (`accent-900`), la única tintada de acento**, texto `#d2cefd`,
  `arrow-clockwise` + botón ghost "Recargar".
- Falla de sync → `#1e2030`, `warning` en `#b5abfc`, nombre de la mascota como link, motivo,
  y `x` para descartar. Es global: se ve esté donde esté el usuario.

---

## Interactions & Behavior

- **Autorización (sin cambios):** lectura pública, escritura admin. RLS es la única garantía
  real; `<AdminOnly>` oculta controles; `<AdminGate>` reemplaza todo el contenido por
  `1m`-bloqueada si hay sesión no-admin.
- **Marcado de hoy:** optimista. Funciona sin conexión (cola en IndexedDB); mientras esté
  encolado, el día muestra el punto de pendiente y la racha lo cuenta como confirmado.
- **Corregir días pasados:** siempre requiere conexión; error inline en el diálogo, nunca
  encola.
- **Racha:** corta con "revisada y no estaba"; "sin registro" ni corta ni extiende.
- **Vista cuadrícula/lista:** preferencia en `localStorage` (sin cambios).
- **Buscador y filtro de zona:** filtran en cliente sobre los datos ya cargados (sin cambios).
- **Navegación del calendario:** acotada a `[registered_on, hoy]`; el `caret` fuera de rango
  va deshabilitado (opacidad .45), no oculto.
- **Eliminar:** diálogo obligatorio → redirige a `/` → franja Deshacer (nueva).
- **Movimiento:** transiciones cortas (120–160ms, ease-out) solo en hover/apertura de
  diálogo. Respetar `prefers-reduced-motion` globalmente, como hoy.
- **Responsive:** 375 / 768 / 1024 / 1440. La ficha pasa a dos columnas recién en ≥1024;
  el catálogo va de 2 columnas (375) a 3–4 (≥768) o tabla en modo lista (≥1024).
- **Táctil:** mínimo 48px en el control de marcado; 44px en campos e ítems de lista.

## State Management

Sin estado nuevo respecto de hoy, salvo:
- `pendingUndo: { petId, snapshot, expiresAt } | null` para la franja Deshacer (`1k`).
- `pastDayDialog: { open, date | null }` — un solo estado para los dos caminos de `1l`
  (`date === null` ⇒ mostrar el selector).

Todo lo demás (sesión, `isAdmin` vía `rpc("is_admin")`, cola offline, preferencia de vista)
queda como está descrito en `referencia/CURRENT_STATE.md`.

## Assets

- **Fuentes:** Inter 400/500/600/700 (Google Fonts, ya importada por `nocturne.css`).
- **Íconos:** Phosphor (`@phosphor-icons/web`) — instalar como dependencia en vez de usar el
  CDN de los mockups. En React conviene `@phosphor-icons/react`.
- **Fotos:** los mockups usan placeholders rayados; las fotos reales van comprimidas en
  cliente (1600px, WebP) y **envueltas en `.lighten`** (`mix-blend-mode: lighten`), que es
  como este sistema integra imágenes al fondo oscuro. Conviene revisarlo con fotos reales
  de día: si el resultado no convence, es el único punto donde me apartaría del sistema.

## Files

- `mockups/PetDex Mockups.dc.html` — todas las pantallas (`1a`–`1n`) en un lienzo.
- `mockups/nocturne.css` — tokens y clases del sistema. **Fuente de verdad de los valores.**
- `mockups/support.js` — runtime necesario para abrir el mockup en el navegador; no forma
  parte del diseño.
- `referencia/CURRENT_STATE.md` — inventario de la UI actual (rutas, componentes, reglas).
- `referencia/nocturne-readme.md` — guía del sistema Nocturne (dirección, color, tipo, do/don't).

## Paleta naranja y temas claro/oscuro

Los mockups del **turno 2** (`2a`, `2b`) y el **turno 3** (`3a`, `3b`) reemplazan la
paleta Nocturne original por el sistema naranja definitivo, en claro y en oscuro.
Los valores exactos, las reglas de contraste y el comportamiento del `ThemeToggle` están
en **`PROMPT-claude-code.md`**, pensado para pegar directo en Claude Code.
Las pantallas del turno 1 siguen siendo la referencia de layout y comportamiento: solo
hay que releer sus colores desde los tokens nuevos.

## Decisiones tomadas

1. **PetCard** (`1d`): **B** — retrato 4:5 con overlay, en la cuadrícula. La lista usa la fila C.
2. **Header** (`1e`): **B** — buscador en el header, en las dos anchuras.
3. **Franja Deshacer** (`1k`): **va**.

Los mockups ya están actualizados con las tres.
