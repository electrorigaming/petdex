import * as React from "react"

import { cn } from "@/lib/utils"

// Nocturne .input: 36px de alto, superficie llena, borde divider — nunca el
// borde plano/foco por defecto del navegador.
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex min-h-9 w-full rounded-md border border-divider bg-card px-2.5 text-label text-card-foreground caret-accent placeholder:text-neutral-600 hover:border-text/45 focus-visible:border-accent focus-visible:outline-0 disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
