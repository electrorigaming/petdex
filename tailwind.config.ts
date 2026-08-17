import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

// Paleta naranja (design-system/design_handoff_v2) — dos temas sobre un
// único set de tokens semánticos, ver app/globals.css. Sin rampa fija
// accent-100..900/neutral-100..900 de v1: un hex compilado acá no puede
// reaccionar a [data-theme], así que todo tinte puntual sale de un token
// semántico (text-secondary/tertiary, accent-fill, hairline, etc.).
// "background"/"foreground"/"card"/"muted"/"border"/"ring" se mantienen como
// alias para no reescribir cada className existente que ya los usa.
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: withOpacity("--color-bg"),
        surface: withOpacity("--color-surface"),
        text: {
          DEFAULT: withOpacity("--color-text"),
          secondary: withOpacity("--color-text-secondary"),
          tertiary: withOpacity("--color-text-tertiary"),
        },
        divider: "var(--color-divider)",
        hairline: "var(--color-hairline)",
        accent: {
          DEFAULT: withOpacity("--color-accent"),
          text: withOpacity("--color-accent-text"),
          fill: {
            DEFAULT: withOpacity("--color-accent-fill"),
            text: withOpacity("--color-accent-fill-text"),
          },
        },
        // Alias semánticos (evitan reescribir cada className existente).
        background: withOpacity("--color-bg"),
        foreground: withOpacity("--color-text"),
        card: {
          DEFAULT: withOpacity("--color-surface"),
          foreground: withOpacity("--color-text"),
        },
        muted: {
          DEFAULT: withOpacity("--color-surface"),
          foreground: withOpacity("--color-text-secondary"),
        },
        border: "var(--color-divider)",
        ring: withOpacity("--color-accent"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Escala Nocturne (nocturne.css h1–h6 + body); los headings nunca
        // pasan de peso 500 — la jerarquía la dan tamaño y espacio, no peso.
        h1: ["42px", { lineHeight: "1.12", letterSpacing: "-0.015em", fontWeight: "500" }],
        h2: ["32px", { lineHeight: "1.12", letterSpacing: "-0.015em", fontWeight: "500" }],
        h3: ["25px", { lineHeight: "1.12", letterSpacing: "-0.015em", fontWeight: "500" }],
        h4: ["20px", { lineHeight: "1.12", letterSpacing: "-0.015em", fontWeight: "500" }],
        h5: ["16px", { lineHeight: "1.12", letterSpacing: "-0.015em", fontWeight: "500" }],
        h6: ["13px", { lineHeight: "1.12", letterSpacing: "0.08em", fontWeight: "500" }],
        body: ["15px", { lineHeight: "1.55", fontWeight: "400" }],
        // Escala menor (botones/inputs 14, meta 13, labels 12, leyendas 11, kickers/números de día 10).
        label: ["14px", { lineHeight: "1.3", fontWeight: "500" }],
        meta: ["13px", { lineHeight: "1.3", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.3", fontWeight: "400" }],
        legend: ["11px", { lineHeight: "1.4", fontWeight: "400" }],
        kicker: ["10px", { lineHeight: "1.3", fontWeight: "400" }],
        // Números grandes fuera de la escala h1–h6 (contador del catálogo,
        // MonthSummary) — tamaño mobile/desktop documentado por pantalla.
        counter: ["38px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "500" }],
        "counter-lg": ["46px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "500" }],
        stat: ["30px", { lineHeight: "1", fontWeight: "500" }],
        "stat-lg": ["34px", { lineHeight: "1", fontWeight: "500" }],
      },
      spacing: {
        "ds-1": "2.8px",
        "ds-2": "5.6px",
        "ds-3": "8.4px",
        "ds-4": "11.2px",
        "ds-6": "16.8px",
        "ds-8": "22.4px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "14px",
      },
      // Dos niveles nomás (sm/md) — el prompt de diseño no da un tercer
      // tier "lg"; el diálogo (única pantalla que pedía shadow-lg) pasa a
      // shadow-md, que ya es el tier "elevado" en este sistema.
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
