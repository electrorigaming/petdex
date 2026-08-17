# Prompt para Claude Code — paleta naranja + toggle claro/oscuro

Copiá el bloque de abajo tal cual en Claude Code, dentro del repo de PetDex, con la
carpeta `design_handoff_petdex_ui/` disponible.

---

Contexto: tenés en `design_handoff_petdex_ui/` el handoff de diseño de PetDex. Leé
`design_handoff_petdex_ui/README.md` completo y abrí `mockups/PetDex Mockups.dc.html`
antes de escribir código. Los mockups están agrupados en turnos: el turno 1 (`1a`–`1n`)
tiene TODAS las pantallas y es la referencia de layout, tipografía, espaciado y
comportamiento; el turno 2 (`2a`, `2b`) y el turno 3 (`3a`, `3b`) muestran la pantalla
principal con la paleta final naranja, en claro y en oscuro.

Tarea: implementar el sistema de color naranja como **dos temas** (claro y oscuro) sobre
un único set de tokens, y agregar el botón de cambio de tema al header. NO cambies
funcionalidad, rutas, queries ni reglas de autorización: es solo la capa de estilo.

## 1. Tokens

Definí los tokens como CSS custom properties en un solo lugar (`app/globals.css` o
equivalente), con el tema claro en `:root` y el oscuro en `[data-theme="dark"]`.
Estos son los valores; no inventes ni redondees ninguno.

**Claro (turno 2)**
```
--color-bg: #fffdfb;        /* blanco cálido, nunca #fff puro */
--color-surface: #fff6f0;   /* cards, inputs */
--color-text: #2a1d15;      /* tinta cálida */
--color-text-secondary: #7a6a5f;   /* 5.1:1 — apodos, metadatos, mail */
--color-text-tertiary: #a3907f;    /* 3.0:1 — SOLO íconos y decoración, nunca texto */
--color-accent: #e0570b;
--color-accent-text: #8a3a06;      /* acento en texto de párrafo */
--color-accent-fill: #fde3cf;      /* fondo de tag/marca */
--color-divider: #ecdcd0;
--color-hairline: #efe1d7;
--shadow-sm: 0 0 0 1px #f0e2d8;
--shadow-md: 0 0 0 1px #efe1d7, 0 8px 24px rgba(90,45,15,.14);
/* trama de placeholder de foto */
--photo-placeholder: repeating-linear-gradient(135deg,#fbeee5 0 6px,#fff6f0 6px 12px);
```

**Oscuro (turno 3)**
```
--color-bg: #17120f;
--color-surface: #241c17;
--color-text: #fdf6f1;
--color-text-secondary: #b8a89c;
--color-text-tertiary: #8c7b6e;
--color-accent: #ff7a33;      /* el #e0570b da 2.9:1 acá; NO reutilizarlo */
--color-accent-text: #ff7a33; /* en oscuro el acento ya sirve para texto (7.2:1) */
--color-accent-fill: #4a2a16;
--color-divider: #3b2f26;
--color-hairline: #4a3b30;
--shadow-sm: 0 0 0 1px #3b2f26;
--shadow-md: 0 0 0 1px #4a3b30, 0 6px 18px rgba(0,0,0,.55);
--photo-placeholder: repeating-linear-gradient(135deg,#2e241d 0 6px,#241c17 6px 12px);
```

Reglas de contraste que hay que respetar y que no son obvias:
- El acento **cambia entre temas**. No uses el mismo hex en los dos.
- `--color-text-tertiary` no llega a AA en ninguno de los dos: úsalo solo para íconos,
  el chip de URL y trama decorativa. Todo texto de 12-13px va en `-secondary`.
- Los tags mantienen el par fill/texto: claro `#fde3cf` con `#8a3a06`; oscuro `#4a2a16`
  con `#ffe2cd`.
- El overlay de la PetCard es el mismo en los dos temas (la foto siempre es oscura
  debajo del texto): `linear-gradient(to top, <tinta> 14%, <tinta a .7> 58%, transparent)`
  con `#2a1d15` en claro y `#100c09` en oscuro, texto blanco encima.

## 2. Reglas de estilo heredadas del sistema

Se mantienen las del handoff, no las reinventes:
- Botones **delineados**, nunca rellenos: el primario es borde + texto de acento sobre
  transparente. Hover `color-mix(in srgb, var(--color-accent) 12%, transparent)`,
  activo 22%.
- `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` en
  todo elemento interactivo. Nada de foco azul del navegador.
- Las reglas horizontales se desvanecen en las puntas:
  `linear-gradient(to right, transparent, var(--color-divider) 48px, var(--color-divider) calc(100% - 48px), transparent)`.
  Los bordes de cajas y separadores internos sí son sólidos.
- Títulos en peso 500 como máximo; la jerarquía es tamaño y espacio.
- Escala compacta y radios de 8px, como ya están descritos en el README.
- `mix-blend-mode: lighten` en las fotos **solo aplica en el tema oscuro**. En claro las
  fotos van sin blend — condicioná esa clase al tema, no la dejes global.

## 3. Botón de tema

Agregá un `ThemeToggle` en el header (variante B del handoff), como `btn-icon
btn-secondary`, entre el mail de la cuenta y el botón de salir; en mobile 375, entre
"Agregar" y salir. Ícono Phosphor: `moon` cuando el tema activo es claro, `sun` cuando es
oscuro. `aria-label` y `title` describiendo la acción ("Cambiar a modo oscuro" /
"Cambiar a modo claro"), más `aria-pressed`.

Comportamiento:
- El tema se aplica con `data-theme="light" | "dark"` en `<html>`.
- Sin elección previa, seguí `prefers-color-scheme` y seguí escuchando sus cambios.
- Al hacer clic, guardá la elección en `localStorage` bajo `petdex-theme`; desde ahí la
  preferencia explícita gana sobre la del sistema.
- **Evitá el flash de tema equivocado**: script inline y bloqueante en `<head>` que lee
  `localStorage` y setea `data-theme` antes del primer paint. En Next.js App Router va en
  `app/layout.tsx` con `dangerouslySetInnerHTML`, y `<html>` necesita
  `suppressHydrationWarning`.
- Actualizá también `<meta name="theme-color">` por tema (`#fffdfb` / `#17120f`), que la
  app es instalable.
- El toggle es visible para todos, no solo para admin.

## 4. Alcance del cambio

Barré el codebase y reemplazá **todo** hex hardcodeado por el token que corresponda; al
terminar no debería quedar ningún color literal en componentes, solo en el bloque de
tokens. Empezá por las primitivas de `src/components/ui/` (botón, input, card, tag, tabla,
diálogo, nav) y recién después por las pantallas, así el cambio se propaga solo.

Puntos donde el tema suele romperse y hay que revisar a mano: el calendario de
avistamientos (`DayCell`: círculo relleno de acento para "vista", borde punteado para
"sin registro", punto de pendiente), los banners de offline/actualización/error, los
estados vacíos, el diálogo de confirmación y su backdrop, y los placeholders de foto.

Verificá los dos temas en las pantallas del turno 1 antes de dar por terminado, y
comprobá que ningún texto quede por debajo de 4.5:1.
