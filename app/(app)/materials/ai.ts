"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/storage/r2";
import {
  generateSummaryMarkdown,
  SUMMARY_GENERATION_VERSION,
} from "@/lib/ai/summary";
import type { ActionState } from "@/lib/forms";

/**
 * Load a material's content for an AI call: PDF bytes from R2 (must be READY),
 * or the typed note text. Returns null if the material is missing/not ready.
 */
async function loadMaterialContent(userId: string, materialId: string) {
  const m = await prisma.material.findFirst({
    where: { id: materialId, userId },
    select: {
      title: true,
      type: true,
      status: true,
      r2Key: true,
      mimeType: true,
      noteText: true,
    },
  });
  if (!m) return null;

  if (m.type === "PDF") {
    if (m.status !== "READY" || !m.r2Key) return null;
    const fileBytes = await getObjectBytes(m.r2Key);
    if (!fileBytes) return null;
    return {
      title: m.title,
      fileBytes,
      mimeType: m.mimeType ?? "application/pdf",
    };
  }
  return { title: m.title, noteText: m.noteText };
}

export async function generateSummary(materialId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const content = await loadMaterialContent(user.id, materialId);
  if (!content) return { ok: false, error: "Material is not ready yet" };

  try {
    const { markdown, modelId } = await generateSummaryMarkdown(content);
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
