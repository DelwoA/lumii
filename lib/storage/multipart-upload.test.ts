import { describe, it, expect, vi, afterEach } from "vitest";
import { planParts, uploadParts } from "./multipart-upload";

describe("planParts", () => {
  it("returns nothing for an empty or invalid file", () => {
    expect(planParts(0, 10)).toEqual([]);
    expect(planParts(-5, 10)).toEqual([]);
    expect(planParts(10, 0)).toEqual([]);
  });

  it("splits into contiguous parts numbered from 1", () => {
    expect(planParts(25, 10)).toEqual([
      { partNumber: 1, start: 0, end: 10 },
      { partNumber: 2, start: 10, end: 20 },
      { partNumber: 3, start: 20, end: 25 },
    ]);
  });

  it("uses a single part when the file fits in one", () => {
    expect(planParts(10, 10)).toEqual([{ partNumber: 1, start: 0, end: 10 }]);
    expect(planParts(7, 10)).toEqual([{ partNumber: 1, start: 0, end: 7 }]);
  });

  it("leaves no empty remainder when evenly divisible", () => {
    expect(planParts(20, 10)).toEqual([
      { partNumber: 1, start: 0, end: 10 },
      { partNumber: 2, start: 10, end: 20 },
    ]);
  });
});

function fakeResponse(etag: string | null, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === "etag" ? etag : null) },
  } as unknown as Response;
}

describe("uploadParts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads every part and returns ETags in part order", async () => {
    const file = new Blob([new Uint8Array(25)]);
    const partUrls = ["u1", "u2", "u3"];
    const fetchMock = vi.fn(async (url: string) => fakeResponse(`"etag-${url}"`));
    vi.stubGlobal("fetch", fetchMock);

    const progress: number[] = [];
    const parts = await uploadParts({
      file,
      partUrls,
      partSize: 10,
      concurrency: 2,
      retryDelayMs: 0,
      onProgress: (done) => progress.push(done),
    });

    expect(parts).toEqual([
      { partNumber: 1, etag: '"etag-u1"' },
      { partNumber: 2, etag: '"etag-u2"' },
      { partNumber: 3, etag: '"etag-u3"' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect([...progress].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it("retries a transient failure then succeeds", async () => {
    const file = new Blob([new Uint8Array(5)]);
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network blip");
      return fakeResponse('"ok"');
    });
    vi.stubGlobal("fetch", fetchMock);

    const parts = await uploadParts({
      file,
      partUrls: ["u1"],
      partSize: 10,
      retryDelayMs: 0,
    });

    expect(parts).toEqual([{ partNumber: 1, etag: '"ok"' }]);
    expect(calls).toBe(2);
  });

  it("rejects once a part exhausts its retries", async () => {
    const file = new Blob([new Uint8Array(5)]);
    const fetchMock = vi.fn(async () => fakeResponse(null, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadParts({
        file,
        partUrls: ["u1"],
        partSize: 10,
        maxRetries: 2,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3); // first try + 2 retries
  });

  it("throws when a part response has no ETag header", async () => {
    const file = new Blob([new Uint8Array(5)]);
    vi.stubGlobal("fetch", vi.fn(async () => fakeResponse(null)));

    await expect(
      uploadParts({
        file,
        partUrls: ["u1"],
        partSize: 10,
        maxRetries: 0,
        retryDelayMs: 0,
      }),
    ).rejects.toThrow();
  });

  it("throws when the URL count does not match the part plan", async () => {
    const file = new Blob([new Uint8Array(25)]); // needs 3 parts
    await expect(
      uploadParts({ file, partUrls: ["u1"], partSize: 10 }),
    ).rejects.toThrow();
  });
});
