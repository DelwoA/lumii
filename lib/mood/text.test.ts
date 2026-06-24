import { describe, it, expect } from "vitest";
import { clampMoodText, MAX_MOOD_CHARS } from "./text";

describe("clampMoodText", () => {
  it("trims surrounding whitespace", () => {
    expect(clampMoodText("  feeling good  ")).toBe("feeling good");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(clampMoodText("   \n\t ")).toBe("");
  });

  it("caps to the max length", () => {
    const long = "a".repeat(MAX_MOOD_CHARS + 500);
    expect(clampMoodText(long)).toHaveLength(MAX_MOOD_CHARS);
  });

  it("leaves no trailing whitespace when the cut lands on spaces (idempotent)", () => {
    // The characters at the cut boundary are spaces, which the final trim drops.
    const input = "x".repeat(MAX_MOOD_CHARS - 1) + "   tail";
    const out = clampMoodText(input);
    expect(out).toBe("x".repeat(MAX_MOOD_CHARS - 1));
    expect(clampMoodText(out)).toBe(out);
  });

  it("is idempotent for ordinary input", () => {
    const out = clampMoodText("  a balanced day of revision  ");
    expect(clampMoodText(out)).toBe(out);
  });
});
