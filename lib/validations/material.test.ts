import { describe, it, expect } from "vitest";
import {
  materialTypeForContentType,
  isAudioContentType,
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

  it("maps every accepted audio type to AUDIO", () => {
    expect(materialTypeForContentType("audio/mpeg")).toBe("AUDIO");
    expect(materialTypeForContentType("audio/wav")).toBe("AUDIO");
    expect(materialTypeForContentType("audio/x-wav")).toBe("AUDIO");
    expect(materialTypeForContentType("audio/mp4")).toBe("AUDIO");
    expect(materialTypeForContentType("audio/x-m4a")).toBe("AUDIO");
    expect(materialTypeForContentType("audio/ogg")).toBe("AUDIO");
  });

  it("returns null for unsupported types", () => {
    expect(materialTypeForContentType("image/gif")).toBeNull();
    expect(materialTypeForContentType("audio/flac")).toBeNull();
    expect(materialTypeForContentType("text/plain")).toBeNull();
    expect(materialTypeForContentType("")).toBeNull();
  });
});

describe("isAudioContentType", () => {
  it("is true only for accepted audio types", () => {
    expect(isAudioContentType("audio/mpeg")).toBe(true);
    expect(isAudioContentType("audio/ogg")).toBe(true);
    expect(isAudioContentType("application/pdf")).toBe(false);
    expect(isAudioContentType("image/png")).toBe(false);
    expect(isAudioContentType("audio/flac")).toBe(false);
  });
});

describe("UPLOAD_CONTENT_TYPES", () => {
  it("is PDF plus the image and audio types", () => {
    expect([...UPLOAD_CONTENT_TYPES]).toEqual([
      PDF_CONTENT_TYPE,
      "image/png",
      "image/jpeg",
      "image/webp",
      "audio/mpeg",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/ogg",
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
