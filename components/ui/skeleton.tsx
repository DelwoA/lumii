// =============================================================================
// FILE: components/ui/skeleton.tsx  (shadcn/ui primitive: generated, then themed)
// WHAT THIS IS: A grey placeholder block shown while content is loading.
//   It is a reusable interface building block added from the shadcn/ui library
//   and themed for LUMII. It is shared across many screens, so change with care.
// HOW TO RESTYLE: the look comes from the Tailwind classes (and the variant
//   definitions) in this file; editing them restyles every Skeleton in the app.
// =============================================================================

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
