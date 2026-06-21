import { ClerkProvider } from "@clerk/nextjs";
import { requireDbUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Full sidebar/topbar shell is added in the app-shell task; for now this gates
// access (lazy-provisioning the user) and provides the Clerk context.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDbUser();
  return <ClerkProvider>{children}</ClerkProvider>;
}
