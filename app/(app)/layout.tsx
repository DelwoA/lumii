import { ClerkProvider } from "@clerk/nextjs";
import { requireDbUser } from "@/lib/auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export const dynamic = "force-dynamic";

// Authenticated application shell: gates access (lazy-provisioning the user),
// provides the Clerk context, and renders the collapsible sidebar + topbar.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDbUser();
  return (
    <ClerkProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <main className="flex flex-1 flex-col">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </ClerkProvider>
  );
}
