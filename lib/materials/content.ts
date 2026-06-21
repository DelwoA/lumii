import "server-only";
import { prisma } from "@/lib/prisma";
import { getObjectBytes } from "@/lib/storage/r2";

export type MaterialAIContent = {
  title: string;
  noteText?: string | null;
  fileBytes?: Uint8Array | null;
  mimeType?: string | null;
};

export type LoadedMaterial = {
  content: MaterialAIContent;
  subjectId: string | null;
  topicId: string | null;
};

/**
 * Load a material's content for an AI call (owner-scoped): a READY PDF's bytes
 * from R2, or the typed-note text. Returns null if missing/not ready.
 */
export async function loadMaterialForAI(
  userId: string,
  materialId: string,
): Promise<LoadedMaterial | null> {
  const m = await prisma.material.findFirst({
    where: { id: materialId, userId },
    select: {
      title: true,
      type: true,
      status: true,
      r2Key: true,
      mimeType: true,
      noteText: true,
      subjectId: true,
      topicId: true,
    },
  });
  if (!m) return null;

  if (m.type === "PDF") {
    if (m.status !== "READY" || !m.r2Key) return null;
    const fileBytes = await getObjectBytes(m.r2Key);
    if (!fileBytes) return null;
    return {
      content: { title: m.title, fileBytes, mimeType: m.mimeType ?? "application/pdf" },
      subjectId: m.subjectId,
      topicId: m.topicId,
    };
  }
  return {
    content: { title: m.title, noteText: m.noteText },
    subjectId: m.subjectId,
    topicId: m.topicId,
  };
}
