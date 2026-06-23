import "server-only";
import { requireServerEnv } from "@/lib/env";
import { orderEmbeddings } from "@/lib/rag/embed-response";

/**
 * Gemini text embeddings via OpenRouter's OpenAI-compatible /embeddings
 * endpoint (the OpenRouter AI-SDK provider only exposes chat, so this calls the
 * REST endpoint directly). 1536 dims keeps vectors inside pgvector's indexable
 * limit; the model returns 3072 by default but honors the `dimensions` request.
 */
const EMBEDDING_MODEL =
  process.env.OPENROUTER_EMBEDDING_MODEL || "google/gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 64;

async function embedBatch(texts: string[]): Promise<number[][]> {
  const { OPENROUTER_API_KEY } = requireServerEnv("OPENROUTER_API_KEY");
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });
  if (!res.ok) {
    throw new Error(`Embeddings request failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { data?: unknown };
  return orderEmbeddings(json.data, texts.length, EMBEDDING_DIMENSIONS);
}

/** Embed many texts (batched), preserving input order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    out.push(...(await embedBatch(texts.slice(i, i + BATCH_SIZE))));
  }
  return out;
}

/** Embed a single query string. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedBatch([text]);
  return vector;
}
