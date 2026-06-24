"use client"

// =============================================================================
// FILE: components/ui/label.tsx  (shadcn/ui primitive: generated, then themed)
// WHAT THIS IS: A caption that labels a form field.
//   It is a reusable interface building block added from the shadcn/ui library
//   and themed for LUMII. It is shared across many screens, so change with care.
// HOW TO RESTYLE: the look comes from the Tailwind classes (and the variant
//   definitions) in this file; editing them restyles every Label in the app.
// =============================================================================

import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
