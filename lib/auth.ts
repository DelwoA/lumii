// =============================================================================
// FILE: lib/auth.ts
// WHAT THIS FILE DOES:
//   Connects the sign-in service (Clerk) to our own database. Clerk knows WHO is
//   logged in; this file finds (or creates) the matching row in our User table
//   so the rest of the app can attach the person's data to them.
//
// KEY IDEA ("lazy provisioning"):
//   The first time someone signs in, they may not have a User row yet. Rather
//   than wait for Clerk's background message (a "webhook", which can arrive a
//   moment late), we create the row on the spot the first time we need it.
//
// THE TWO FUNCTIONS YOU WILL CALL:
//   - getOrCreateDbUser(): returns the user, or null if nobody is signed in.
//   - requireDbUser():     returns the user, or sends them to /sign-in.
//                          Almost every signed-in page/action starts with this.
//
// NOTE: "server-only" at the top guarantees this file can never be bundled into
//   the browser, because it touches secrets and the database.
// =============================================================================
import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("LUMII could not reach its database");
    this.name = "DatabaseUnavailableError";
  }
}

function isDatabaseUnavailable(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P1001"
  ) {
    return true;
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError &&
    error.errorCode === "P1001"
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Can't reach database server") ||
    message.includes(
      "Timed out fetching a new connection from the connection pool",
    )
  );
}

/**
 * Resolve the LUMII (Prisma) user for the current Clerk session, lazily
 * provisioning a row on first authenticated request. The Clerk webhook keeps
 * it in sync afterwards, but webhook delivery is eventually consistent, so we
 * never depend on it for a user to become usable.
 */
export const getOrCreateDbUser = cache(async (): Promise<User | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const existing = await prisma.user.findUnique({
      where: { clerkId: userId },
    });
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
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      throw new DatabaseUnavailableError();
    }
    throw error;
  }
});

/** Require an authenticated, provisioned user or redirect to sign-in. */
export async function requireDbUser(): Promise<User> {
  const user = await getOrCreateDbUser();
  if (!user) redirect("/sign-in");
  return user;
}
