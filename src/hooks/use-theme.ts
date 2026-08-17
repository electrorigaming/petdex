"use client"

import { useCallback, useEffect, useState } from "react"

export type Theme = "light" | "dark"

export const THEME_STORAGE_KEY = "petdex-theme"

const THEME_COLOR: Record<Theme, string> = {
  light: "#fffdfb",
  dark: "#17120f",
}

function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark")
  } else {
    document.documentElement.removeAttribute("data-theme")
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme])
}

function resolveTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
}

// El script anti-flash de app/layout.tsx ya decidió y aplicó el tema antes
// de la hidratación (localStorage > prefers-color-scheme) — este hook solo
// lee ese resultado, nunca lo recalcula, para no pisarlo con un flash.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    setTheme(resolveTheme())

    // Sin preferencia guardada, seguir el cambio de tema del SO en vivo.
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    function handleSystemChange(e: MediaQueryListEvent) {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return
      const next = e.matches ? "dark" : "light"
      applyTheme(next)
      setTheme(next)
    }
    media.addEventListener("change", handleSystemChange)
    return () => media.removeEventListener("change", handleSystemChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark"
      applyTheme(next)
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // Storage no disponible (modo privado) — el toggle sigue funcionando en memoria.
      }
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
