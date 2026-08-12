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
//   - Signed-in reads are user-keyed, and safe reusable data is cached through
//     Next.js Cache Components while request-only UI streams behind Suspense.
// =============================================================================
import { requireDbUser } from "@/lib/auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar, AppSidebarFallback } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { ActiveSessionBar } from "@/components/session/active-session-bar";
import { CelebrationOverlay } from "@/components/celebration/celebration-overlay";
import { Suspense } from "react";
import { getCachedGamificationSummary } from "@/lib/cache/app-data";

async function AuthenticatedSidebar() {
  const user = await requireDbUser();
  const summary = await getCachedGamificationSummary(user.id);
  return <AppSidebar summary={summary} />;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebarFallback />}>
        <AuthenticatedSidebar />
      </Suspense>
      <SidebarInset>
        <AppTopbar />
        <Suspense fallback={null}>
          <ActiveSessionBar />
        </Suspense>
        <main className="flex flex-1 flex-col">{children}</main>
      </SidebarInset>
      <CelebrationOverlay />
    </SidebarProvider>
  );
}
