import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the LUMII (Prisma) user for the current Clerk session, lazily
 * provisioning a row on first authenticated request. The Clerk webhook keeps
 * it in sync afterwards, but webhook delivery is eventually consistent, so we
 * never depend on it for a user to become usable.
 */
export async function getOrCreateDbUser(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const cu = await currentUser();
  const email =
    cu?.primaryEmailAddress?.emailAddress ??
    cu?.emailAddresses?.[0]?.emailAddress ??
    undefined;
  const displayName = cu
    ? [cu.firstName, cu.lastName].filter(Boolean).join(" ") ||
      cu.username ||
      undefined
    : undefined;

  // upsert is idempotent under a race (two concurrent first requests).
  return prisma.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: { clerkId: userId, email, displayName },
  });
}

/** Require an authenticated, provisioned user or redirect to sign-in. */
export async function requireDbUser(): Promise<User> {
  const user = await getOrCreateDbUser();
  if (!user) redirect("/sign-in");
  return user;
}
