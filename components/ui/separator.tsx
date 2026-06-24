"use client"

// =============================================================================
// FILE: components/ui/separator.tsx  (shadcn/ui primitive: generated, then themed)
// WHAT THIS IS: A thin dividing line.
//   It is a reusable interface building block added from the shadcn/ui library
//   and themed for LUMII. It is shared across many screens, so change with care.
// HOW TO RESTYLE: the look comes from the Tailwind classes (and the variant
//   definitions) in this file; editing them restyles every Separator in the app.
// =============================================================================

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
