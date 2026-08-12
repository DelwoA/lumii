import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getGamificationSummary } from "@/lib/gamification/service";
import { getAchievementsData } from "@/lib/gamification/service";

export async function getCachedGamificationSummary(userId: string) {
  "use cache";
  cacheLife("seconds");
  cacheTag(`user:${userId}:gamification`);
  return getGamificationSummary(userId);
}

export async function getCachedSubjectTree(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${userId}:subjects`);
  return prisma.subject.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      topics: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
}

export async function getCachedAchievementsData(userId: string) {
  "use cache";
  cacheLife("seconds");
  cacheTag(`user:${userId}:gamification`);
  return getAchievementsData(userId);
}
