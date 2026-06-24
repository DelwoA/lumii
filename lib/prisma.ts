// =============================================================================
// FILE: lib/prisma.ts
// WHAT THIS FILE DOES:
//   Creates the single shared "Prisma client", which is the object the whole
//   back-end uses to talk to the database (for example: prisma.user.findMany()).
//   Everywhere else in the code we import { prisma } from "@/lib/prisma".
//
// WHY THE GLOBAL TRICK BELOW:
//   During development Next.js reloads code often. Without this guard, each
//   reload would open a brand-new database connection and we would quickly run
//   out. Storing one client on the global object reuses it across reloads.
//   In production a fresh client is created normally.
// =============================================================================
import { PrismaClient } from "@prisma/client";

// A typed handle on the global object so we can stash one client on it.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
