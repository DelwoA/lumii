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
