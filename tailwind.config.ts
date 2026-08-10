import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`
}

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: withOpacity("--color-primary"),
          foreground: withOpacity("--color-on-primary"),
        },
        secondary: {
          DEFAULT: withOpacity("--color-secondary"),
        },
        accent: {
          DEFAULT: withOpacity("--color-accent"),
          foreground: withOpacity("--color-on-accent"),
        },
        background: withOpacity("--color-background"),
        foreground: withOpacity("--color-foreground"),
        card: {
          DEFAULT: withOpacity("--color-card"),
          foreground: withOpacity("--color-card-foreground"),
        },
        muted: {
          DEFAULT: withOpacity("--color-muted"),
          foreground: withOpacity("--color-muted-foreground"),
        },
        border: withOpacity("--color-border"),
        input: withOpacity("--color-border"),
        destructive: {
          DEFAULT: withOpacity("--color-destructive"),
          foreground: withOpacity("--color-on-primary"),
        },
        ring: withOpacity("--color-ring"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["24px", { lineHeight: "1.3", fontWeight: "700" }],
        h2: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        label: ["14px", { lineHeight: "1.4", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      borderRadius: {
        lg: "8px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
