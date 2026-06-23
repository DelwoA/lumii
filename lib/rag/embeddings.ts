import "server-only";
import { requireServerEnv } from "@/lib/env";

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
  const json = (await res.json()) as {
    data?: { index?: number; embedding?: number[] }[];
  };
  const data = json.data;
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error("Unexpected embeddings response shape");
  }
  // The OpenAI-compatible response may be unordered; restore input order.
  return [...data]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d) => {
      if (!Array.isArray(d.embedding) || d.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error("Unexpected embedding dimension");
      }
      return d.embedding;
    });
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
