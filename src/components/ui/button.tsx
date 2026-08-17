import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Siempre delineado, nunca relleno grande — "primary" es el acento en
// borde+texto, nunca un fondo de acento sólido. El texto usa
// --color-accent-text (no --color-accent crudo) porque es el par calibrado
// para AA sobre bg/surface; el borde sí puede ser el acento crudo, es
// decorativo.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent text-label font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "border-accent text-accent-text hover:bg-accent/[.12] active:bg-accent/[.22]",
        secondary: "border-divider text-text hover:bg-text/[.07] active:bg-text/[.14]",
        ghost: "border-transparent text-accent-text px-2 hover:bg-accent/10 active:bg-accent/[.18]",
      },
      size: {
        default: "h-10 px-4",
        icon: "h-9 w-9 p-0",
        block: "h-12 w-full px-4",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
