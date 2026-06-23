/**
 * Pure validation/ordering for an OpenAI-compatible embeddings response. Kept
 * dependency-free (no server-only imports) so it can be unit-tested directly.
 */
export interface EmbeddingDatum {
  index?: number;
  embedding?: number[];
}

/**
 * Validate and order an embeddings response. The response may be unordered, so
 * each datum is placed by its `index`; the indices must form exactly
 * 0..count-1 (no missing, duplicate, or out-of-range), and every vector must
 * have the expected dimension with only finite values.
 */
export function orderEmbeddings(
  data: unknown,
  count: number,
  dims: number,
): number[][] {
  if (!Array.isArray(data) || data.length !== count) {
    throw new Error("Unexpected embeddings response shape");
  }
  const result: (number[] | undefined)[] = new Array(count);
  for (const datum of data as EmbeddingDatum[]) {
    const i = datum.index;
    if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= count) {
      throw new Error("Embedding index out of range");
    }
    if (result[i as number]) throw new Error("Duplicate embedding index");
    const e = datum.embedding;
    if (
      !Array.isArray(e) ||
      e.length !== dims ||
      !e.every((x) => Number.isFinite(x))
    ) {
      throw new Error("Unexpected embedding dimension");
    }
    result[i as number] = e;
  }
  // Count matches and indices are unique within range, so there are no holes.
  return result as number[][];
}
