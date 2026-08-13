import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Nocturne .tag: rótulo chico tintado de una rampa — nunca del color de
// peligro (no existe en esta paleta).
const badgeVariants = cva("inline-flex items-center rounded-sm px-2.5 py-0.5 text-legend", {
  variants: {
    variant: {
      accent: "bg-accent-800 text-accent-100",
      neutral: "bg-neutral-800 text-neutral-100",
      outline: "border border-accent text-accent",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
})

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
