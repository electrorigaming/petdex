import * as React from "react"

import { cn } from "@/lib/utils"

// Mismo tratamiento visual que RadioChip (borde/texto acento cuando está
// activo), pero como botón aria-pressed en vez de input[type=radio]: acá
// varios chips del mismo grupo pueden estar activos a la vez.
const FilterChip = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, "aria-pressed": pressed, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-divider px-3.5 py-2 text-label text-text transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed && "border-accent text-accent",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
FilterChip.displayName = "FilterChip"

export { FilterChip }
