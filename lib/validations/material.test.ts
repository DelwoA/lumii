import { describe, it, expect } from "vitest";
import {
  materialTypeForContentType,
  requestUploadInput,
  UPLOAD_CONTENT_TYPES,
  MAX_FILE_BYTES,
  PDF_CONTENT_TYPE,
} from "./material";

describe("materialTypeForContentType", () => {
  it("maps PDF to the PDF material type", () => {
    expect(materialTypeForContentType("application/pdf")).toBe("PDF");
  });

  it("maps every accepted image type to IMAGE", () => {
    expect(materialTypeForContentType("image/png")).toBe("IMAGE");
    expect(materialTypeForContentType("image/jpeg")).toBe("IMAGE");
    expect(materialTypeForContentType("image/webp")).toBe("IMAGE");
  });

  it("returns null for unsupported types", () => {
    expect(materialTypeForContentType("image/gif")).toBeNull();
    expect(materialTypeForContentType("text/plain")).toBeNull();
    expect(materialTypeForContentType("")).toBeNull();
  });
});

describe("UPLOAD_CONTENT_TYPES", () => {
  it("is exactly PDF plus the three image types", () => {
    expect([...UPLOAD_CONTENT_TYPES]).toEqual([
      PDF_CONTENT_TYPE,
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);
  });
});

describe("requestUploadInput", () => {
  const base = {
    title: "Lecture 1",
    fileName: "scan.png",
    sizeBytes: 1024,
  };

  it("accepts a valid image upload", () => {
    const r = requestUploadInput.safeParse({
      ...base,
      contentType: "image/png",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unsupported content type", () => {
    const r = requestUploadInput.safeParse({
      ...base,
      contentType: "image/gif",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a file over the size cap", () => {
    const r = requestUploadInput.safeParse({
      ...base,
      contentType: "application/pdf",
      sizeBytes: MAX_FILE_BYTES + 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty file", () => {
    const r = requestUploadInput.safeParse({
      ...base,
      contentType: "application/pdf",
      sizeBytes: 0,
    });
    expect(r.success).toBe(false);
  });
});
