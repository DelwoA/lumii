// =============================================================================
// FILE: lib/rag/chunk.ts   ("rag" = retrieval-augmented generation, the smart
//                            search that powers the tutor.)
// WHAT THIS FILE DOES:
//   Splits a long piece of text (a note or an audio transcript) into smaller,
//   overlapping "chunks". We do this because smart search works best on small
//   pieces: each chunk later gets turned into numbers (an embedding) so the
//   tutor can find the few most relevant pieces for a question.
//
//   The chunks slightly overlap (the "overlap" setting) so an idea split across
//   a boundary is not lost. It also tries to cut at a natural break (a paragraph,
//   line, sentence, or word) rather than mid-word. Pure logic, unit-tested in
//   chunk.test.ts.
// =============================================================================
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
