// =============================================================================
// FILE: components/theme-provider.tsx
// WHAT THIS FILE DOES:
//   A thin wrapper around the next-themes provider, used once in the root layout.
//   It supplies the light/dark theme context to the whole app. (LUMII is locked
//   to dark mode by the settings passed to it in app/layout.tsx.)
// =============================================================================
"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
