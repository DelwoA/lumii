// =============================================================================
// FILE: components/app-topbar.tsx
// WHAT THIS FILE DOES:
//   The bar across the top of every signed-in page. It holds the button that
//   collapses the sidebar, the "Start session" button, and the profile menu.
//   STYLE: the bar's look (height, border, background) is the className on the
//   <header> below; edit it to restyle the top bar.
// =============================================================================
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { StartSessionButton } from "@/components/session/start-session-button";
import { UserMenu } from "@/components/user-menu";

export function AppTopbar() {
  return (
    <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <StartSessionButton />
        <UserMenu />
      </div>
    </header>
  );
}
