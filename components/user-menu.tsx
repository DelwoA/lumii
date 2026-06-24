// =============================================================================
// FILE: components/user-menu.tsx
// WHAT THIS FILE DOES:
//   The round profile button at the top-right. It is simply Clerk's <UserButton>,
//   whose menu shows only Clerk's own actions (Manage account, Sign out). App
//   navigation is in the sidebar, so it is deliberately not repeated here.
// =============================================================================
"use client";

import { UserButton } from "@clerk/nextjs";

/**
 * The Clerk account avatar. The dropdown keeps only Clerk's own account
 * actions ("Manage account", "Sign out"); in-app navigation lives in the
 * sidebar, so it is not duplicated here. Used in the app topbar and landing nav.
 */
export function UserMenu() {
  return <UserButton />;
}
