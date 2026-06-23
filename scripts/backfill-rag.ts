/**
 * One-off, idempotent RAG backfill. Embeds the text of notes and ready audio
 * transcripts that have no MaterialChunk rows yet (e.g. materials created before
 * RAG shipped, or where indexing failed), so the tutor can retrieve over them
 * instead of falling back to full text.
 *
 * It intentionally mirrors the small embed + raw-insert logic from
 * lib/rag/{embeddings,service} rather than importing them: those modules are
 * server-only and cannot be imported into a plain Node script. The pure helpers
 * (chunkText, orderEmbeddings) are reused.
 *
 * Run (loads both env files):
 *   node --env-file=.env --env-file=.env.local --import tsx scripts/backfill-rag.ts
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chunkText } from "../lib/rag/chunk";
import { orderEmbeddings } from "../lib/rag/embed-response";

const EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL || "google/gemini-embedding-001";
const DIMS = 1536;
const BATCH = 64;

const prisma = new PrismaClient();

async function embed(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch, dimensions: DIMS }),
    });
    if (!res.ok) throw new Error(`Embeddings request failed (HTTP ${res.status})`);
    const json = (await res.json()) as { data?: unknown };
    out.push(...orderEmbeddings(json.data, batch.length, DIMS));
  }
  return out;
}

async function indexMaterial(id: string, userId: string, text: string): Promise<number> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return 0;
  const embeddings = await embed(chunks);
  await prisma.$transaction(async (tx) => {
    await tx.materialChunk.deleteMany({ where: { materialId: id, userId } });
    for (let i = 0; i < chunks.length; i++) {
      await tx.$executeRaw`
        INSERT INTO "MaterialChunk"
          ("id", "userId", "materialId", "chunkIndex", "content", "embedding", "createdAt")
        VALUES (
          ${randomUUID()}, ${userId}, ${id}, ${i}, ${chunks[i]},
          ${`[${embeddings[i].join(",")}]`}::vector, NOW()
        )
      `;
    }
  });
  return chunks.length;
}

async function main(): Promise<void> {
  const materials = await prisma.material.findMany({
    where: {
      chunks: { none: {} },
      OR: [
        { type: "NOTE", noteText: { not: null } },
        { type: "AUDIO", status: "READY", transcript: { not: null } },
      ],
    },
    select: { id: true, userId: true, type: true, noteText: true, transcript: true },
  });

  console.log(`Found ${materials.length} material(s) to backfill.`);
  let totalChunks = 0;
  for (const m of materials) {
    const text = m.type === "AUDIO" ? m.transcript : m.noteText;
    if (!text) continue;
    const n = await indexMaterial(m.id, m.userId, text);
    totalChunks += n;
    console.log(`  indexed ${m.id} (${m.type}) -> ${n} chunk(s)`);
  }
  console.log(`Done: ${totalChunks} chunk(s) across ${materials.length} material(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
