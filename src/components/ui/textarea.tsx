import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[90px] w-full resize-y rounded-md border border-divider bg-card px-2.5 py-1.5 text-label text-card-foreground caret-accent placeholder:text-neutral-600 hover:border-text/45 focus-visible:border-accent focus-visible:outline-0 disabled:opacity-45",
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
