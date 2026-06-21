"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMaterialForAI } from "@/lib/materials/content";
import {
  generateSummaryMarkdown,
  SUMMARY_GENERATION_VERSION,
} from "@/lib/ai/summary";
import type { ActionState } from "@/lib/forms";

export async function generateSummary(materialId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const loaded = await loadMaterialForAI(user.id, materialId);
  if (!loaded) return { ok: false, error: "Material is not ready yet" };

  try {
    const { markdown, modelId } = await generateSummaryMarkdown(loaded.content);
    await prisma.summary.create({
      data: {
        userId: user.id,
        materialId,
        content: markdown,
        modelId,
        generationVersion: SUMMARY_GENERATION_VERSION,
      },
    });
    revalidatePath(`/materials/${materialId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not generate the summary. Please try again." };
  }
}
