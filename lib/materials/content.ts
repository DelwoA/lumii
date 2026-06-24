// =============================================================================
// FILE: lib/materials/content.ts
// WHAT THIS FILE DOES:
//   Fetches a material's content ready to hand to an AI feature, and does it
//   safely (owner-scoped: it only finds the material if it belongs to this user).
//   Depending on the material type it returns the right thing:
//     - NOTE  -> the typed text.
//     - AUDIO -> the saved transcript (the audio itself is not re-sent).
//     - PDF / IMAGE -> the file's bytes loaded from storage (only when READY).
//   Returns null if the material is missing, not the user's, or not ready yet.
//   This is the shared loader used by the summary, quiz, and tutor features.
// =============================================================================
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
 * Load a material's content for an AI call (owner-scoped): a READY file's bytes
 * (PDF or image) from R2, or the typed-note text. Returns null if missing or
 * not ready.
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
      transcript: true,
      subjectId: true,
      topicId: true,
    },
  });
  if (!m) return null;

  if (m.type === "NOTE") {
    return {
      content: { title: m.title, noteText: m.noteText },
      subjectId: m.subjectId,
      topicId: m.topicId,
    };
  }

  // Audio: the transcript is the text content (the audio is not re-sent).
  if (m.type === "AUDIO") {
    if (m.status !== "READY" || !m.transcript) return null;
    return {
      content: { title: m.title, noteText: m.transcript },
      subjectId: m.subjectId,
      topicId: m.topicId,
    };
  }

  // File material (PDF or image): load the bytes from R2 once it is READY.
  if (m.status !== "READY" || !m.r2Key) return null;
  const fileBytes = await getObjectBytes(m.r2Key);
  if (!fileBytes) return null;
  return {
    content: {
      title: m.title,
      fileBytes,
      mimeType: m.mimeType ?? "application/octet-stream",
    },
    subjectId: m.subjectId,
    topicId: m.topicId,
  };
}
