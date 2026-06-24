// =============================================================================
// FILE: lib/public-profile.ts
// WHAT THIS FILE DOES:
//   Powers the OPTIONAL public showcase page at /u/<handle>. It builds the
//   PUBLIC view of a profile, which deliberately includes ONLY safe, chosen
//   fields: display name, rank, trophies, and (optionally) total points. It
//   never exposes materials, quizzes, timetable, sessions, or mood.
//
//   If the profile is switched off, the lookup returns nothing so the page shows
//   "not found". normalizeHandle + HANDLE_RE keep handles consistent and valid.
// =============================================================================
import "server-only";
import type { Rank } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Allowed handle shape: 3-30 chars of lowercase letters, digits, hyphen. */
export const HANDLE_RE = /^[a-z0-9-]{3,30}$/;

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export interface PublicTrophy {
  code: string;
  name: string;
  description: string;
  icon: string;
  unlockedAtISO: string;
}

export interface PublicProfileView {
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Null when the user has hidden their rank. */
  rank: Rank | null;
  /** Null when the user has hidden their XP. */
  totalXp: number | null;
  memberSince: string;
  trophies: PublicTrophy[];
}

/**
 * The public projection for /u/[handle]. Returns null (-> 404) when the handle
 * does not exist or the profile is private. ONLY allowlisted, non-sensitive
 * fields are ever returned; never materials, quizzes, timetable, sessions, or
 * mood.
 */
export async function getPublicProfileByHandle(
  handleRaw: string,
): Promise<PublicProfileView | null> {
  const handle = normalizeHandle(handleRaw);
  if (!HANDLE_RE.test(handle)) return null;

  const profile = await prisma.publicProfile.findUnique({ where: { handle } });
  if (!profile || !profile.isPublic) return null;

  const [user, gamification, userTrophies] = await Promise.all([
    prisma.user.findUnique({
      where: { id: profile.userId },
      select: { createdAt: true },
    }),
    prisma.gamificationProfile.findUnique({ where: { userId: profile.userId } }),
    prisma.userTrophy.findMany({
      where: { userId: profile.userId },
      orderBy: { unlockedAt: "desc" },
      include: {
        trophy: {
          select: { code: true, name: true, description: true, icon: true },
        },
      },
    }),
  ]);

  const memberSince = (user?.createdAt ?? new Date()).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    rank: profile.showRank ? (gamification?.rank ?? "BRONZE") : null,
    totalXp: profile.showXp ? (gamification?.totalXp ?? 0) : null,
    memberSince,
    trophies: userTrophies.map((ut) => ({
      code: ut.trophy.code,
      name: ut.trophy.name,
      description: ut.trophy.description,
      icon: ut.trophy.icon,
      unlockedAtISO: ut.unlockedAt.toISOString(),
    })),
  };
}
