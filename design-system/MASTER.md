# PetDex — Design System (Master)

Generado con `ui-ux-pro-max` (dominio veterinary/animal-tracker) y ajustado a
mano a los seis principios no negociables de `.specify/memory/constitution.md`.
Leer este archivo antes de escribir cualquier UI; si existe
`design-system/pages/<pagina>.md`, sus reglas tienen prioridad sobre las de acá.

**Estilo base**: Minimalism & Swiss Style — grid-based, alto contraste,
tipografía como jerarquía principal, cero decoración innecesaria.

## Paleta

Monocromática (zinc) + un único acento azul. Nada de gradientes; el acento se
usa solo para acciones/estados interactivos, nunca como color decorativo.

| Rol | Hex | CSS Variable | Uso |
|---|---|---|---|
| Primary (texto/íconos fuertes) | `#18181B` | `--color-primary` | Texto principal, íconos activos, botón primario |
| On Primary | `#FFFFFF` | `--color-on-primary` | Texto sobre fondo primary |
| Secondary | `#3F3F46` | `--color-secondary` | Texto secundario, subtítulos |
| Accent (único) | `#2563EB` | `--color-accent` | Foco, enlaces, estado activo del toggle, botón de acción |
| On Accent | `#FFFFFF` | `--color-on-accent` | Texto/ícono sobre el acento |
| Background | `#FAFAFA` | `--color-background` | Fondo de página |
| Foreground | `#09090B` | `--color-foreground` | Texto sobre `background` |
| Card | `#FFFFFF` | `--color-card` | Fondo de tarjeta |
| Card Foreground | `#09090B` | `--color-card-foreground` | Texto sobre tarjeta |
| Muted | `#E8ECF0` | `--color-muted` | Fondos secundarios (placeholder, skeleton) |
| Muted Foreground | `#64748B` | `--color-muted-foreground` | Texto de apoyo (fecha, zona en tarjeta) |
| Border | `#E4E4E7` | `--color-border` | Bordes de tarjeta, separadores |
| Destructive | `#DC2626` | `--color-destructive` | Reservado (esta feature no lo usa: es de solo lectura) |
| Ring (foco) | `#2563EB` | `--color-ring` | Igual al acento — foco de teclado siempre visible, 3px mínimo |

Todos los pares texto/fondo de esta tabla cumplen 4.5:1 (Principio II). El
acento (`#2563EB` sobre `#FFFFFF`) da 5.2:1.

### Dark mode

No es alcance de esta feature (no hay toggle de tema pedido), pero los
tokens están declarados como variables CSS para no bloquearlo después:
`--color-background: #0B0B0C`, `--color-foreground: #FAFAFA`,
`--color-card: #18181B`, `--color-border: #27272A`, acento igual (`#2563EB`
mantiene 4.5:1 sobre ambos fondos).

## Tipografía

**Familia única**: Inter (variable), para heading y body — "Minimal Swiss": un
solo tipo de letra con variación de peso, sin mezclar familias.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

| Token | Tamaño / línea | Peso | Uso |
|---|---|---|---|
| `--text-display` | 32px / 1.2 | 700 | Contador destacado de la Pantalla A |
| `--text-h1` | 24px / 1.3 | 700 | Nombre de la mascota en la ficha |
| `--text-h2` | 18px / 1.4 | 600 | Títulos de sección (timeline, "Resultados") |
| `--text-body` | 16px / 1.5 | 400 | Texto general — nunca menos de 16px en mobile |
| `--text-label` | 14px / 1.4 | 500 | Etiquetas de campo, texto de tarjeta (zona, fecha) |
| `--text-caption` | 12px / 1.4 | 500 | Solo para metadatos no críticos (nunca contenido primario) |

## Espaciado

Escala de 8px (estándar, no dashboard-densa — hay pocas pantallas y hay que
poder tocar todo con una mano):

`--space-1: 4px · --space-2: 8px · --space-3: 12px · --space-4: 16px · --space-6: 24px · --space-8: 32px · --space-12: 48px · --space-16: 64px`

Padding de tarjeta: `--space-4` (16px). Gap de cuadrícula: `--space-4` en
mobile, `--space-6` desde 768px.

## Breakpoints (mobile-first, Principio III)

```css
/* base: 375px */
@media (min-width: 768px)  { /* tablet */ }
@media (min-width: 1024px) { /* desktop */ }
@media (min-width: 1440px) { /* desktop grande */ }
```

Cuadrícula: 1 columna a 375px, 2 columnas a 768px, 3 a 1024px, 4 a 1440px.
Buscador, filtro de zona y el alternador de vista quedan siempre alcanzables
con el pulgar en la mitad inferior de la pantalla en mobile (nunca arriba de
todo fuera de alcance, nunca requieren dos manos).

## Iconografía

**Lucide** (`lucide-react`) exclusivamente — no Phosphor ni Heroicons, y
nunca emojis como ícono funcional (Principio II). Stroke width consistente
en 1.5px, tamaño base 20px (24px en controles primarios), `aria-label` en
todo ícono sin texto acompañante.

| Ícono | Uso |
|---|---|
| `LayoutGrid` / `List` | Alternador de vista |
| `Search` | Buscador |
| `MapPin` | Zona (tarjeta y ficha) |
| `ImageOff` | Placeholder de foto faltante |
| `ArrowUpDown` | Invertir orden de la timeline |
| `CalendarDays` | Fecha de registro / fecha de hito |

## Componentes shadcn/ui a inicializar

Solo los que esta feature usa (ver `research.md` §7): `card`, `badge`,
`input`, `select`, `button`, `skeleton`. Preferir composición (`Card` +
`CardHeader` + `CardContent`) sobre props monolíticas.

### Tarjeta de mascota (`pet-card`)

- Contenedor: `bg-card border border-border rounded-lg` — radio `8px`, sin
  sombra decorativa (Swiss: el borde basta para separar del fondo).
- Imagen: `aspect-square` (cuadrícula) o `aspect-[3/2]` (lista), `object-cover`,
  `next/image` con `alt` descriptivo (nombre de la mascota).
- Sin foto: fondo `--color-muted` + ícono `ImageOff` centrado, mismo
  `aspect-ratio` que una foto real — nunca cambia el layout de la tarjeta
  (Principio IV, FR-019).
- Texto: nombre en `--text-h2`/600, zona en `--text-label` con ícono `MapPin`
  y color `--color-muted-foreground`.
- Estado presionado/hover: `transition-colors 150ms`, borde pasa a
  `--color-accent` — sin `transform: scale` (evita layout shift en listas).

### Etiqueta de categoría de hito (`milestone-badge`)

Un color de fondo `--color-muted` fijo para las cuatro categorías del CHECK
de base (`salud`, `alimentacion`, `comportamiento`, `otro`) — el Principio II
prohíbe usar el color como único portador de significado, así que la
categoría siempre se distingue por **texto**, no por un color por categoría:

```
[ícono opcional] Salud       — texto --color-primary sobre --color-muted
[ícono opcional] Alimentación
[ícono opcional] Comportamiento
[ícono opcional] Otro
```

Un hito sin categoría simplemente no muestra badge (FR-013/omitir vacíos).

### Estados vacío / sin resultados (mensajes distintos, FR-009/FR-010)

| Estado | Título | Cuerpo | Ícono |
|---|---|---|---|
| Vacío (sin mascotas en el sistema) | "Todavía no hay mascotas registradas" | "Cuando se registre la primera, va a aparecer acá." | — (sin ícono decorativo; Swiss = texto directo) |
| Sin resultados (búsqueda/filtro sin match) | "Sin resultados para tu búsqueda" | "Probá con otro nombre, apodo o cambiá el filtro de zona." | `Search` atenuado |

Nunca "0 resultados" a secas (anti-patrón de dead-end): siempre con una
sugerencia de próxima acción.

## Movimiento

- Duración: 150–250ms, `ease-out` al entrar. Solo transiciones de color/opacidad
  (nunca `width`/`height`) para no generar layout shift.
- `prefers-reduced-motion: reduce` → todas las transiciones a `0.01ms`
  (Principio II); ningún contenido depende de la animación para ser legible.
- El toggle de vista cambia de layout sin animación de entrada compleja (fade
  simple ≤150ms) para no competir con la lectura del script anti-flash
  (`research.md` §3).

## Foco y teclado

Anillo de foco visible siempre: `outline: 2px solid var(--color-ring); outline-offset: 2px`
— nunca `outline: none` sin reemplazo. Orden de tabulación: buscador → filtro
de zona → alternador de vista → tarjetas en orden de grilla → paginación (N/A
en esta feature, sin paginación).

## Checklist de esta feature antes de mergear

- [ ] Contraste 4.5:1 verificado en texto de tarjeta sobre `--color-muted`
- [ ] Ningún ícono funcional sin `aria-label`
- [ ] Cuadrícula y ficha usables a 375px con una sola mano
- [ ] `prefers-reduced-motion` respetado en toggle y transiciones de tarjeta
- [ ] Cero emojis en el código de UI
