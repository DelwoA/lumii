import { describe, it, expect } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns nothing for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single trimmed chunk when within the size limit", () => {
    expect(chunkText("  hello world  ")).toEqual(["hello world"]);
  });

  it("splits long text into multiple chunks within the size limit", () => {
    const text = "word ".repeat(1000); // ~5000 chars
    const chunks = chunkText(text, { maxChars: 1000, overlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
  });

  it("covers the whole input across chunks", () => {
    const text = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkText(text, { maxChars: 200, overlap: 20 });
    const joined = chunks.join(" ");
    expect(joined).toContain("w0");
    expect(joined).toContain("w299");
  });

  it("hard-cuts text with no boundaries and still terminates", () => {
    const text = "abcdefghij".repeat(50); // 500 chars, no spaces
    const chunks = chunkText(text, { maxChars: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
  });

  it("overlaps consecutive chunks", () => {
    const text = Array.from({ length: 100 }, (_, i) => `token${i}`).join(" ");
    const chunks = chunkText(text, { maxChars: 120, overlap: 40 });
    // The tail of one chunk should reappear at the head of the next.
    const firstTail = chunks[0].slice(-10);
    expect(chunks[1].includes(firstTail.trim().split(" ").pop() ?? "")).toBe(
      true,
    );
  });
});
