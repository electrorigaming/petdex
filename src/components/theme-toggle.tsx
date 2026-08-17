"use client"

import { SunIcon } from "@phosphor-icons/react/dist/ssr/Sun"
import { MoonIcon } from "@phosphor-icons/react/dist/ssr/Moon"
import { useTheme } from "@/hooks/use-theme"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      aria-pressed={isDark}
    >
      {isDark ? (
        <SunIcon size={18} aria-hidden="true" />
      ) : (
        <MoonIcon size={18} aria-hidden="true" />
      )}
    </Button>
  )
}
