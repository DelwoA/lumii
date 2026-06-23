import { describe, it, expect } from "vitest";
import {
  isPdfMagic,
  isPngMagic,
  isJpegMagic,
  isWebpMagic,
  isMp3Magic,
  isWavMagic,
  isM4aMagic,
  isOggMagic,
  matchesMagic,
} from "./magic";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
// "RIFF" + 4 size bytes + "WEBP"
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("file signature checks", () => {
  it("accepts each format's own bytes", () => {
    expect(isPdfMagic(PDF)).toBe(true);
    expect(isPngMagic(PNG)).toBe(true);
    expect(isJpegMagic(JPEG)).toBe(true);
    expect(isWebpMagic(WEBP)).toBe(true);
  });

  it("rejects null, empty, and too-short buffers", () => {
    for (const fn of [isPdfMagic, isPngMagic, isJpegMagic, isWebpMagic]) {
      expect(fn(null)).toBe(false);
      expect(fn(new Uint8Array([]))).toBe(false);
      expect(fn(new Uint8Array([0x00, 0x01]))).toBe(false);
    }
  });

  it("does not confuse one format for another", () => {
    expect(isPdfMagic(PNG)).toBe(false);
    expect(isPngMagic(PDF)).toBe(false);
    expect(isJpegMagic(PNG)).toBe(false);
    expect(isWebpMagic(JPEG)).toBe(false);
  });

  it("requires the WEBP tag, not just the RIFF container", () => {
    const riffOnly = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20,
    ]); // RIFF....AVI (not WebP)
    expect(isWebpMagic(riffOnly)).toBe(false);
  });
});

// Audio fixtures.
const MP3_ID3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]); // "ID3"
const MP3_SYNC = new Uint8Array([0xff, 0xfb, 0x90, 0x00]); // MPEG frame sync
const WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
]); // RIFF....WAVE
const M4A = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20,
]); // ....ftypM4A
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00]); // "OggS"

describe("audio signature checks", () => {
  it("accepts each audio format's bytes", () => {
    expect(isMp3Magic(MP3_ID3)).toBe(true);
    expect(isMp3Magic(MP3_SYNC)).toBe(true);
    expect(isWavMagic(WAV)).toBe(true);
    expect(isM4aMagic(M4A)).toBe(true);
    expect(isOggMagic(OGG)).toBe(true);
  });

  it("rejects null, empty, and too-short buffers", () => {
    for (const fn of [isMp3Magic, isWavMagic, isM4aMagic, isOggMagic]) {
      expect(fn(null)).toBe(false);
      expect(fn(new Uint8Array([]))).toBe(false);
    }
  });

  it("does not confuse audio formats with each other or with images", () => {
    expect(isWavMagic(OGG)).toBe(false);
    expect(isOggMagic(WAV)).toBe(false);
    expect(isM4aMagic(MP3_ID3)).toBe(false);
    expect(isMp3Magic(PNG)).toBe(false);
  });
});

describe("matchesMagic", () => {
  it("pairs each accepted mime type with its signature", () => {
    expect(matchesMagic("application/pdf", PDF)).toBe(true);
    expect(matchesMagic("image/png", PNG)).toBe(true);
    expect(matchesMagic("image/jpeg", JPEG)).toBe(true);
    expect(matchesMagic("image/webp", WEBP)).toBe(true);
    expect(matchesMagic("audio/mpeg", MP3_ID3)).toBe(true);
    expect(matchesMagic("audio/wav", WAV)).toBe(true);
    expect(matchesMagic("audio/x-wav", WAV)).toBe(true);
    expect(matchesMagic("audio/mp4", M4A)).toBe(true);
    expect(matchesMagic("audio/x-m4a", M4A)).toBe(true);
    expect(matchesMagic("audio/ogg", OGG)).toBe(true);
  });

  it("fails when the bytes do not match the declared mime type", () => {
    expect(matchesMagic("application/pdf", PNG)).toBe(false);
    expect(matchesMagic("image/png", JPEG)).toBe(false);
    expect(matchesMagic("audio/mpeg", WAV)).toBe(false);
    expect(matchesMagic("audio/ogg", MP3_ID3)).toBe(false);
  });

  it("rejects unknown or empty mime types", () => {
    expect(matchesMagic("text/plain", PDF)).toBe(false);
    expect(matchesMagic("", PDF)).toBe(false);
    expect(matchesMagic("image/gif", new Uint8Array([0x47, 0x49, 0x46]))).toBe(
      false,
    );
  });
});
