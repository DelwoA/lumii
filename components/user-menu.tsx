"use client";

import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard, Settings, Trophy } from "lucide-react";

/**
 * The Clerk account avatar with extra in-app links bolted onto its dropdown
 * (Dashboard, Achievements, Settings). Clerk's own "Manage account" and
 * "Sign out" actions remain. Used in the app topbar and the landing nav.
 */
export function UserMenu() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="Dashboard"
          labelIcon={<LayoutDashboard className="size-4" />}
          href="/dashboard"
        />
        <UserButton.Link
          label="Achievements"
          labelIcon={<Trophy className="size-4" />}
          href="/achievements"
        />
        <UserButton.Link
          label="Settings"
          labelIcon={<Settings className="size-4" />}
          href="/settings"
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}
