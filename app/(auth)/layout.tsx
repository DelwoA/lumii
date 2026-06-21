import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { LumenSpark } from "@/components/lumen-spark";

export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
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
    </ClerkProvider>
  );
}
