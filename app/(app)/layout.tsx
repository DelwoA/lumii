// =============================================================================
// FILE: app/(app)/layout.tsx  (the SIGNED-IN APP SHELL)
// WHAT THIS FILE DOES:
//   The folder name "(app)" in round brackets is a Next.js "route group": it
//   groups all the signed-in pages (dashboard, subjects, materials, ...) without
//   adding a word to the web address. This layout wraps ALL of those pages.
//
//   On every signed-in page it:
//     1. Requires a logged-in user (requireDbUser); if missing, sign-in is shown.
//     2. Loads the small points/rank/streak summary for the sidebar footer.
//     3. Draws the shared frame: the left Sidebar, the Topbar, the running
//        study-session bar, and the celebration pop-up layer.
//
// HOW TO FIND THINGS:
//   - The left navigation menu lives in components/app-sidebar.tsx.
//   - The top bar (Start session, profile) lives in components/app-topbar.tsx.
//   - "force-dynamic" below means these pages are always built fresh per request
//     (because they show the signed-in user's own data).
// =============================================================================
import { requireDbUser } from "@/lib/auth";
import { getGamificationSummary } from "@/lib/gamification/service";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { ActiveSessionBar } from "@/components/session/active-session-bar";
import { CelebrationOverlay } from "@/components/celebration/celebration-overlay";

export const dynamic = "force-dynamic";

// Authenticated application shell: gates access (lazy-provisioning the user),
// provides the Clerk context, and renders the collapsible sidebar + topbar.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireDbUser();
  const summary = await getGamificationSummary(user.id);
  return (
    <SidebarProvider>
      <AppSidebar summary={summary} />
      <SidebarInset>
        <AppTopbar />
        <ActiveSessionBar />
        <main className="flex flex-1 flex-col">{children}</main>
      </SidebarInset>
      <CelebrationOverlay />
    </SidebarProvider>
  );
}
