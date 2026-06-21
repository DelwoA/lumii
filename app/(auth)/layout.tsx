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
      <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background p-6">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <LumenSpark className="size-6" />
          LUMII
        </a>
        {children}
      </main>
    </ClerkProvider>
  );
}
