"use server";

// =============================================================================
// FILE: app/(app)/materials/ai.ts
// WHAT THIS FILE DOES:
//   The server actions for the AI features on a material: generating a summary,
//   starting and submitting a quiz, and the tutor chat reply. These tie together
//   the building blocks from lib/ai (the model calls), lib/materials/content
//   (loading the material), lib/quiz/token (hiding the answer key), and the
//   rewards system (awarding points + returning what to celebrate).
//
//   Like all server actions it runs on the server, checks the owner first, and
//   is called straight from the material page's Summary / Quiz / Chat tabs.
// =============================================================================

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
import { getCurrentRank, runAwardChecks } from "@/lib/gamification/service";
import { bumpEngagement } from "@/lib/sessions/service";
import type { ActionState } from "@/lib/forms";
import type { Celebration } from "@/lib/gamification/celebration";

export type SummaryResult = ActionState & {
  celebration?: Celebration;
  xpAwarded?: number;
};

export async function generateSummary(materialId: string): Promise<SummaryResult> {
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
    // Capture rank before awarding so we can detect a rank-up to celebrate.
    const rankBefore = await getCurrentRank(user.id);
    const { xpAwarded } = await awardXp({
      userId: user.id,
      type: "SUMMARY_GENERATED",
      requestedXp: XP_RULES.SUMMARY_GENERATED,
      idempotencyKey: `summary-generated:${summary.id}`,
      sourceType: "summary",
      sourceId: summary.id,
    });
    await bumpEngagement(user.id, "summariesViewed");
    const celebration = await runAwardChecks(user.id, rankBefore);
    revalidatePath(`/materials/${materialId}`);
    return { ok: true, celebration, xpAwarded };
  } catch {
    return { ok: false, error: "Could not generate the summary. Please try again." };
  }
}
