import { describe, expect, it } from "vitest";
import { materialTitleFromFilename, materialTitleFromNote } from "./title";

describe("material titles", () => {
  it("derives a readable material name from a file without asking the user", () => {
    expect(materialTitleFromFilename("week_04-newton-laws.pdf")).toBe(
      "week 04 newton laws",
    );
  });

  it("uses the first meaningful note line and strips a markdown heading", () => {
    expect(
      materialTitleFromNote("\n# Momentum and Impulse\nNotes follow"),
    ).toBe("Momentum and Impulse");
  });

  it("has friction-free fallbacks for otherwise blank names", () => {
    expect(materialTitleFromFilename(".pdf")).toBe("Study Material");
    expect(materialTitleFromNote("  \n  ")).toBe("Study Note");
  });
});
