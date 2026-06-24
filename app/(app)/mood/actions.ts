"use server";

import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeMood, type MoodValence } from "@/lib/ai/mood";

export type MoodResult =
  | { ok: true; heading: string; mood: string; valence: MoodValence }
  | { ok: false; error: string };

/**
 * Record a free-text mood check-in. The description is analysed by the model
 * into a short heading + a 1-3 word mood + a coarse valence, and all of it is
 * stored privately (kept until the user deletes it; never on the public page).
 */
export async function logMood(description: string): Promise<MoodResult> {
  const user = await requireDbUser();
  const trimmed = description.trim();
  if (!trimmed) {
    return { ok: false, error: "Write a little about how studying feels." };
  }
  try {
    const { heading, mood, valence } = await analyzeMood(trimmed);
    await prisma.moodCheckin.create({
      data: {
        userId: user.id,
        description: trimmed.slice(0, 2000),
        heading,
        mood,
        valence,
        // expiresAt left null: kept until the user deletes it.
      },
    });
    await prisma.activityEvent.create({
      data: { userId: user.id, type: "MOOD_LOGGED", xpDelta: 0 },
    });
    return { ok: true, heading, mood, valence };
  } catch {
    return {
      ok: false,
      error: "Could not record your check-in. Please try again.",
    };
  }
}

/** Delete all of the user's mood data (privacy control in Settings). */
export async function deleteMoodData(): Promise<{ ok: true }> {
  const user = await requireDbUser();
  await prisma.moodCheckin.deleteMany({ where: { userId: user.id } });
  return { ok: true };
}
