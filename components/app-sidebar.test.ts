import { describe, expect, it } from "vitest";
import { isNavActive } from "@/lib/navigation";

describe("Study Library navigation", () => {
  it.each([
    "/library",
    "/library/new",
    "/library/materials/material-1",
    "/library/subjects/subject-1",
  ])("marks %s as active", (pathname) => {
    expect(isNavActive(pathname, "/library")).toBe(true);
  });

  it("does not mark legacy or unrelated routes as active", () => {
    expect(isNavActive("/materials", "/library")).toBe(false);
    expect(isNavActive("/dashboard", "/library")).toBe(false);
  });
});
