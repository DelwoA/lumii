import { ClerkProvider } from "@clerk/nextjs";
import { requireDbUser } from "@/lib/auth";
import { getGamificationSummary } from "@/lib/gamification/service";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { ActiveSessionBar } from "@/components/session/active-session-bar";

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
    <ClerkProvider>
      <SidebarProvider>
        <AppSidebar summary={summary} />
        <SidebarInset>
          <AppTopbar />
          <ActiveSessionBar />
          <main className="flex flex-1 flex-col">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ClerkProvider>
  );
}
