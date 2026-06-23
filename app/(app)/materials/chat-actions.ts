"use server";

import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMaterialForAI } from "@/lib/materials/content";
import { chatReply } from "@/lib/ai/tutor";
import { bumpEngagement } from "@/lib/sessions/service";
import { hasChunks, retrieveChunks } from "@/lib/rag/service";
import type { ChatMessage } from "@/lib/ai/chat-types";

export type ChatResult = { ok: true; reply: string } | { ok: false; error: string };

const MAX_INCOMING = 24;

export async function chatAboutMaterial(
  materialId: string,
  history: ChatMessage[],
): Promise<ChatResult> {
  const user = await requireDbUser();
  const trimmed = history.slice(-MAX_INCOMING);
  const lastQuestion =
    [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";

  // Prefer the latest summary as cheap text context (avoids re-sending the PDF).
  const summary = await prisma.summary.findFirst({
    where: { materialId, userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });

  try {
    // RAG: if this material has an embedding index (notes/transcripts), ground
    // the reply in the chunks most relevant to the latest question rather than
    // inlining all of its text.
    if (lastQuestion && (await hasChunks(materialId, user.id))) {
      const meta = await prisma.material.findFirst({
        where: { id: materialId, userId: user.id },
        select: { title: true },
      });
      if (!meta) return { ok: false, error: "Material not found" };
      const chunks = await retrieveChunks(user.id, materialId, lastQuestion, 5);
      const { text } = await chatReply({
        title: meta.title,
        context: chunks.join("\n\n---\n\n"),
        history: trimmed,
      });
      await bumpEngagement(user.id, "tutorQuestions");
      return { ok: true, reply: text };
    }

    if (summary) {
      const meta = await prisma.material.findFirst({
        where: { id: materialId, userId: user.id },
        select: { title: true },
      });
      if (!meta) return { ok: false, error: "Material not found" };
      const { text } = await chatReply({
        title: meta.title,
        context: summary.content,
        history: trimmed,
      });
      await bumpEngagement(user.id, "tutorQuestions");
      return { ok: true, reply: text };
    }

    const loaded = await loadMaterialForAI(user.id, materialId);
    if (!loaded) return { ok: false, error: "Material is not ready yet" };
    const context = loaded.content.noteText ?? null;
    const { text } = await chatReply({
      title: loaded.content.title,
      context,
      fileBytes: context ? null : loaded.content.fileBytes,
      mimeType: context ? null : loaded.content.mimeType,
      history: trimmed,
    });
    await bumpEngagement(user.id, "tutorQuestions");
    return { ok: true, reply: text };
  } catch {
    return { ok: false, error: "The tutor could not respond. Please try again." };
  }
}
