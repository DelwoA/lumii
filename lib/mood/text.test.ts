import { describe, it, expect } from "vitest";
import {
  clampMoodText,
  MAX_MOOD_CHARS,
  MOOD_MAX_WORDS,
  tidyHeading,
  tidyMood,
} from "./text";

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

describe("tidyMood", () => {
  it("keeps a natural up-to-4-word phrase whole", () => {
    expect(tidyMood("calm and on track")).toBe("calm and on track");
    expect(tidyMood("drained but hopeful")).toBe("drained but hopeful");
    expect(tidyMood("motivated")).toBe("motivated");
  });

  it("caps to the max word count", () => {
    expect(tidyMood("anxious but slowly getting there").split(" ")).toHaveLength(
      MOOD_MAX_WORDS,
    );
  });

  it("drops a trailing connective the cap would expose (no dangling fragment)", () => {
    // "calm and on track and more" -> first 4 "calm and on track" -> ends clean.
    expect(tidyMood("calm and on track and more")).toBe("calm and on track");
    // "feeling good but a little" -> first 4 "feeling good but a" -> trim "a","but".
    expect(tidyMood("feeling good but a little")).toBe("feeling good");
  });

  it("strips trailing punctuation and lowercases-safe whitespace", () => {
    expect(tidyMood("  exhausted.  ")).toBe("exhausted");
  });

  it("returns empty string for empty input", () => {
    expect(tidyMood("   ")).toBe("");
  });

  it("never trims a single word down to nothing", () => {
    // A lone filler word stays rather than becoming empty.
    expect(tidyMood("and")).toBe("and");
  });
});

describe("tidyHeading", () => {
  it("collapses whitespace and drops trailing punctuation", () => {
    expect(tidyHeading("  Pre-Exam   Nerves!  ")).toBe("Pre-Exam Nerves");
  });

  it("caps long headings", () => {
    expect(
      tidyHeading("One Two Three Four Five Six Seven Eight").split(" ").length,
    ).toBeLessThanOrEqual(6);
  });
});
