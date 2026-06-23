/**
 * Split text into overlapping chunks for embedding/retrieval. Pure and
 * dependency-free so it can be unit-tested directly. Chunks are sized by
 * characters (a cheap proxy for tokens) and prefer to break on a paragraph,
 * line, sentence, or word boundary near the target size to keep them coherent.
 */
export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const maxChars = options.maxChars ?? 1200;
  const overlap = options.overlap ?? 150;

  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    // Pull the cut back to a natural boundary if one sits in the latter half.
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const boundary = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf(" "),
      );
      if (boundary > maxChars * 0.5) end = start + boundary + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
