import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Rótulo chico tintado — nunca del color de peligro (no existe en esta
// paleta). "neutral" lleva hairline propio porque suele flotar sobre una
// foto, no sobre --color-bg: sin borde se mimetizaría con el fondo claro.
const badgeVariants = cva("inline-flex items-center rounded-sm px-2.5 py-0.5 text-legend", {
  variants: {
    variant: {
      accent: "bg-accent-fill text-accent-fill-text",
      neutral: "border border-hairline bg-surface text-text-secondary",
      outline: "border border-accent text-accent-text",
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
