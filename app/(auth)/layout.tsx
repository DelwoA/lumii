import Link from "next/link";
import { LumenSpark } from "@/components/lumen-spark";

export const dynamic = "force-dynamic";

// Clerk context is provided by the root layout; this layout only frames the
// Clerk-hosted sign-in / sign-up cards.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <Link
        href="/"
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <LumenSpark className="size-6" />
        LUMII
      </Link>
      {children}
    </main>
  );
}
