import { requireDbUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireDbUser();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{user.displayName ? `, ${user.displayName}` : ""}.
      </h1>
      <p className="mt-2 text-muted-foreground">
        Your dashboard is coming together. Sign-in and account provisioning are
        live.
      </p>
    </div>
  );
}
