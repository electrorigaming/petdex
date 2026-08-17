# PetDex — logo 4c "chapita"

Marca elegida: el disco de una chapita de identificación con la huella calada y una
argolla arriba. La idea: **la chapita es justo lo que estas mascotas no tienen y el
registro les da** — un nombre y alguien que responde por ellas.

Los archivos de esta carpeta son la fuente. El mockup vive en
`../mockups/PetDex Mockups.dc.html`, turno 4, opción `4c`.

## Las dos formas de la marca

La marca tiene **dos formas y son las dos correctas**. No es una inconsistencia: la
argolla es un detalle de 7px de trazo que se empasta abajo de 24px, así que desaparece.

| Forma | Cuándo | Archivo |
|---|---|---|
| **Símbolo** — disco + argolla, `viewBox 0 0 100 106` | ≥28px: header, login, splash, impresos, stickers | `petdex-symbol-*.svg` |
| **Marca corta** — disco solo, `viewBox 0 0 100 100` | ≤24px: favicon, ícono de app, avatares, badges | `petdex-mark-*.svg`, `favicon.svg` |

Regla simple para implementar: **si el alto renderizado es menor a 28px, usá la marca corta.**

## Color

Un solo naranja en dos valores, los mismos tokens de la app:

| | Disco / argolla | Huella (calada) |
|---|---|---|
| Sobre claro | `#E0570B` | `#FFFDFB` |
| Sobre oscuro | `#FF7A33` | `#17120F` |
| Sobre naranja | `#FFFDFB` | `#E0570B` |

- La huella **siempre es el color del fondo**, no blanco fijo: es un calado, no una capa.
  Por eso hay un archivo por tema en vez de uno solo.
- `petdex-symbol-mono.svg` usa `currentColor` en el disco: sirve para heredar el color del
  contexto (un botón, un texto) sin duplicar archivos.
- Nunca degradados, sombras, contornos ni una tercera tinta.

## Lockup horizontal

Símbolo + wordmark "Pet**Dex**", con "Pet" en `--color-text` y "Dex" en `--color-accent`.

- Tipografía: **Inter 600**, `letter-spacing: -0.035em`. Es un peso más que los títulos de
  la interfaz (500) y es deliberado — el logo no es un heading.
- **Altura del símbolo = 1.4× el tamaño de la tipografía del wordmark.** En el header
  (wordmark 19px) el símbolo mide 27px de alto.
- **Separación = 0.5× la altura del símbolo.** Con símbolo de 27px, `gap: 13px`.
- Alineación: centrado vertical del disco con la altura de la x, no del bloque completo
  (en la práctica: `align-items: center` sobre el flex, con el SVG a su alto natural).
- **Área de resguardo:** el radio del disco alrededor de todo el lockup. Nada entra ahí.
- **Tamaño mínimo del lockup:** 100px de ancho. Abajo de eso, marca corta sola.

## Archivos

```
logo/
├── petdex-symbol-light.svg    disco + argolla, naranja #E0570B, calado blanco cálido
├── petdex-symbol-dark.svg     ídem en #FF7A33, calado #17120F
├── petdex-symbol-mono.svg     disco en currentColor
├── petdex-mark-light.svg      disco solo, claro
├── petdex-mark-dark.svg       disco solo, oscuro
├── favicon.svg                disco, cambia de tema solo vía prefers-color-scheme
├── icon-any.svg               512px, purpose "any" — disco a sangre del lienzo
└── icon-maskable.svg          512px, purpose "maskable" — fondo naranja lleno, huella al 45%
```

El maskable es distinto a propósito: los lanzadores de Android recortan el ícono, así que
el disco desaparece y el fondo pasa a ser el cuadrado naranja completo, con la huella
dentro del 80% central (zona segura). No sirve reutilizar `icon-any.svg` ahí.

## Prompt para Claude Code

Copiá desde acá:

---

Implementá el logo de PetDex. Los SVG fuente están en `design_handoff_petdex_ui/logo/` y
la especificación completa en `design_handoff_petdex_ui/logo/README.md` — leelo antes de
empezar. La marca ya está decidida: no rediseñes ni "mejores" el dibujo.

1. Copiá los SVG a `public/` (o el directorio de estáticos del proyecto).

2. Creá un componente `<Logo>` en `src/components/` con props
   `variant: "lockup" | "symbol" | "mark"` (default `"lockup"`) y `size` en px
   (default: el alto del símbolo).
   - Inliná el SVG en el componente en vez de usar `<img>`, para que herede el tema y se
     pueda animar o teñir. Un solo path set; el color del disco sale de
     `var(--color-accent)` y el calado de `var(--color-bg)`, así el logo cambia con el
     tema claro/oscuro sin archivos duplicados ni JS.
   - Si `size < 28`, renderizá la marca corta (sin argolla, `viewBox 0 0 100 100`) aunque
     pidan `variant="symbol"`. Esa regla vive en el componente, no en cada llamada.
   - `role="img"` + `<title>PetDex</title>`; cuando el lockup ya muestra el nombre en
     texto, el SVG va `aria-hidden="true"` para no duplicarlo en el lector de pantalla.

3. Reemplazá el ícono `paw-print` de Phosphor que hoy hace de marca en el header por
   `<Logo variant="lockup" size={27} />`, en las dos anchuras. El wordmark es texto real
   (Inter 600, `letter-spacing:-0.035em`), no parte del SVG: "Pet" en `var(--color-text)`,
   "Dex" en `var(--color-accent)`. El lockup del header linkea a `/`.

4. Metadata y PWA:
   - `favicon.svg` como `<link rel="icon" type="image/svg+xml">`, más un `favicon.ico`
     rasterizado de 32px como fallback.
   - En el manifest, dos entradas: `icon-any.svg` con `"purpose": "any"` y
     `icon-maskable.svg` con `"purpose": "maskable"`. No uses el mismo archivo para las dos.
   - `apple-touch-icon` de 180px rasterizado desde `icon-any.svg` sobre fondo `#E0570B`
     (iOS no respeta la transparencia).
   - `theme-color` por tema, como ya está definido: `#FFFDFB` / `#17120F`.

5. Usá el símbolo grande (128px) centrado arriba del formulario en la pantalla de login, y
   la marca corta de 20px como avatar por defecto de las mascotas sin foto en la vista
   lista — reemplaza al `image-square` gris de los mockups.

No agregues el logo a ningún otro lado sin preguntar; en particular, nada de marca de agua
sobre las fotos ni logo repetido en cada card.
