import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

// Nocturne (design-system/design_handoff_v1/mockups/nocturne.css) — tokens
// portados literalmente. "background"/"foreground"/"card"/"muted"/"border"/
// "ring" se mantienen como alias semánticos de los roles de Nocturne para no
// tener que tocar cada className existente que ya los usa; los pasos de
// rampa (accent-100..900, neutral-100..900) quedan disponibles directo para
// el código nuevo que necesita un tinte puntual (bg-accent-800, etc.).
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
        text: withOpacity("--color-text"),
        sunken: withOpacity("--color-sunken"),
        divider: "var(--color-divider)",
        accent: {
          DEFAULT: withOpacity("--color-accent"),
          100: "#f5f4ff",
          200: "#e7e5fe",
          300: "#d2cefd",
          400: "#b5abfc",
          500: "#968ae0",
          600: "#796cbf",
          700: "#5d5294",
          800: "#423a6a",
          900: "#2b2741",
        },
        neutral: {
          100: "#f3f5fe",
          200: "#e4e7f5",
          300: "#cfd3e5",
          400: "#b2b6ca",
          500: "#9397ab",
          600: "#75798c",
          700: "#595d6c",
          800: "#3f424d",
          900: "#292b31",
        },
        // Alias semánticos (evitan reescribir cada className existente).
        background: withOpacity("--color-bg"),
        foreground: withOpacity("--color-text"),
        card: {
          DEFAULT: withOpacity("--color-surface"),
          foreground: withOpacity("--color-text"),
        },
        muted: {
          DEFAULT: withOpacity("--color-sunken"),
          foreground: "#9397ab", // neutral-500, "texto secundario" de Nocturne
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
      boxShadow: {
        sm: "0 0 0 1px #3f424d",
        md: "0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)",
        lg: "0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
