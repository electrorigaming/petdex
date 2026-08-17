import * as React from "react"

import { cn } from "@/lib/utils"

// Nocturne .radio: input nativo oculto + .dot dibujado a mano — usado para
// elecciones exclusivas en línea (ej. estado de una mascota, PetForm).
const Radio = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, children, ...props }, ref) => (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 text-label text-text",
        className
      )}
    >
      <input ref={ref} type="radio" className="peer sr-only" {...props} />
      <span
        className="h-4 w-4 flex-none rounded-full border-[1.5px] border-divider transition-colors duration-150 peer-checked:border-accent peer-checked:bg-accent peer-checked:shadow-[inset_0_0_0_4px_rgb(var(--color-bg))] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
        aria-hidden="true"
      />
      {children}
    </label>
  )
)
Radio.displayName = "Radio"

// Nocturne .seg-opt usado como chip individual (MilestoneForm, categoría):
// mismo input oculto, pero el estado "elegido" lo marca el borde + color del
// propio chip en vez de un punto separado.
const RadioChip = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, children, ...props }, ref) => (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-divider px-3.5 py-2 text-label text-text transition-colors duration-150 has-[:checked]:border-accent has-[:checked]:text-accent-text has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        className
      )}
    >
      <input ref={ref} type="radio" className="sr-only" {...props} />
      {children}
    </label>
  )
)
RadioChip.displayName = "RadioChip"

export { Radio, RadioChip }
