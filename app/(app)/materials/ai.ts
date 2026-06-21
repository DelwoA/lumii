"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMaterialForAI } from "@/lib/materials/content";
import {
  generateSummaryMarkdown,
  SUMMARY_GENERATION_VERSION,
} from "@/lib/ai/summary";
import { awardXp } from "@/lib/gamification/award";
import { XP_RULES } from "@/lib/gamification/xp";
import { checkTrophies } from "@/lib/gamification/service";
import { bumpEngagement } from "@/lib/sessions/service";
import type { ActionState } from "@/lib/forms";

export async function generateSummary(materialId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const loaded = await loadMaterialForAI(user.id, materialId);
  if (!loaded) return { ok: false, error: "Material is not ready yet" };

  try {
    const { markdown, modelId } = await generateSummaryMarkdown(loaded.content);
    const summary = await prisma.summary.create({
      data: {
        userId: user.id,
        materialId,
        content: markdown,
        modelId,
        generationVersion: SUMMARY_GENERATION_VERSION,
      },
      select: { id: true },
    });
    // Ledger event + a small XP award (idempotent on the summary row), and a
    // best-effort engagement bump if a study session is currently running.
    await awardXp({
      userId: user.id,
      type: "SUMMARY_GENERATED",
      requestedXp: XP_RULES.SUMMARY_GENERATED,
      idempotencyKey: `summary-generated:${summary.id}`,
      sourceType: "summary",
      sourceId: summary.id,
    });
    await bumpEngagement(user.id, "summariesViewed");
    await checkTrophies(user.id);
    revalidatePath(`/materials/${materialId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not generate the summary. Please try again." };
  }
}
