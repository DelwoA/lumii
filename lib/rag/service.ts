import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts, embedQuery } from "@/lib/rag/embeddings";

/** Format a number[] as a pgvector literal (e.g. "[0.1,0.2]"). */
function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * (Re)build the retrieval index for a material's text: chunk it, embed the
 * chunks, and replace the stored chunks. The embedding column is a pgvector type
 * Prisma cannot write, so rows are inserted via raw SQL (the value is bound as a
 * parameter and cast to vector). Safe to call with empty text.
 *
 * Precondition: callers MUST pass an already owner-verified (materialId, userId)
 * pair (every current caller loads the material by id+userId first). This does
 * not re-verify ownership, so do not call it with an unvalidated pair.
 */
export async function indexMaterial(
  materialId: string,
  userId: string,
  text: string | null,
): Promise<void> {
  const chunks = chunkText(text ?? "");
  if (chunks.length === 0) {
    await prisma.materialChunk.deleteMany({ where: { materialId, userId } });
    return;
  }
  const embeddings = await embedTexts(chunks);

  await prisma.$transaction(async (tx) => {
    await tx.materialChunk.deleteMany({ where: { materialId, userId } });
    for (let i = 0; i < chunks.length; i++) {
      await tx.$executeRaw`
        INSERT INTO "MaterialChunk"
          ("id", "userId", "materialId", "chunkIndex", "content", "embedding", "createdAt")
        VALUES (
          ${randomUUID()}, ${userId}, ${materialId}, ${i}, ${chunks[i]},
          ${vectorLiteral(embeddings[i])}::vector, NOW()
        )
      `;
    }
  });
}

/** True if a material has an embedding index (owner-scoped). */
export async function hasChunks(
  materialId: string,
  userId: string,
): Promise<boolean> {
  const count = await prisma.materialChunk.count({
    where: { materialId, userId },
  });
  return count > 0;
}

/** Retrieve the top-k chunks most similar to the query (cosine distance). */
export async function retrieveChunks(
  userId: string,
  materialId: string,
  query: string,
  k = 5,
): Promise<string[]> {
  if (!query.trim()) return [];
  const queryVector = vectorLiteral(await embedQuery(query));
  const rows = await prisma.$queryRaw<{ content: string }[]>`
    SELECT "content"
    FROM "MaterialChunk"
    WHERE "materialId" = ${materialId} AND "userId" = ${userId}
    ORDER BY "embedding" <=> ${queryVector}::vector
    LIMIT ${k}
  `;
  return rows.map((r) => r.content);
}
