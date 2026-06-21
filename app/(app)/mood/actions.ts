"use server";

import type { MoodLabel } from "@prisma/client";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyMood, MOOD_LABELS } from "@/lib/ai/mood";

const RETENTION_DAYS = 30;

export type MoodResult =
  | { ok: true; label: MoodLabel | null }
  | { ok: false; error: string };

function expiry(): Date {
  return new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** Purge any of the user's expired mood rows (compute-on-access retention). */
async function purgeExpired(userId: string): Promise<void> {
  await prisma.moodCheckin.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  });
}

/** Classify a free-text check-in and store the LABEL ONLY (never the text). */
export async function logMoodFromText(text: string): Promise<MoodResult> {
  const user = await requireDbUser();
  await purgeExpired(user.id);
  try {
    const { label } = await classifyMood(text);
    await prisma.moodCheckin.create({
      data: { userId: user.id, classifiedLabel: label, expiresAt: expiry() },
    });
    await prisma.activityEvent.create({
      data: { userId: user.id, type: "MOOD_LOGGED", xpDelta: 0 },
    });
    return { ok: true, label };
  } catch {
    return { ok: false, error: "Could not record your check-in. Please try again." };
  }
}

/** Record a self-selected mood label (no AI call). */
export async function logMoodSelf(label: MoodLabel): Promise<MoodResult> {
  const user = await requireDbUser();
  if (!MOOD_LABELS.includes(label)) {
    return { ok: false, error: "Unknown mood" };
  }
  await purgeExpired(user.id);
  await prisma.moodCheckin.create({
    data: { userId: user.id, selfLabel: label, expiresAt: expiry() },
  });
  await prisma.activityEvent.create({
    data: { userId: user.id, type: "MOOD_LOGGED", xpDelta: 0 },
  });
  return { ok: true, label };
}

/** Delete all of the user's mood data (privacy control in Settings). */
export async function deleteMoodData(): Promise<{ ok: true }> {
  const user = await requireDbUser();
  await prisma.moodCheckin.deleteMany({ where: { userId: user.id } });
  return { ok: true };
}
