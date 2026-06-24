// =============================================================================
// FILE: hooks/use-mobile.ts
// WHAT THIS FILE DOES:
//   A small reusable "hook" (a function whose name starts with "use" that React
//   components call to get reactive values). useIsMobile() returns true when the
//   screen is phone-sized, so components can switch to a mobile-friendly layout.
//
// HOW IT WORKS:
//   It watches the browser width with matchMedia and updates whenever the window
//   crosses the 768px line (the point we treat as the boundary to "mobile").
//
// HOW TO CHANGE: edit MOBILE_BREAKPOINT below to move that boundary.
// =============================================================================
import * as React from "react"

// Screens narrower than this many pixels are treated as "mobile".
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
