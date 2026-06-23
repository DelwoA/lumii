/**
 * Client-side multipart upload helper. Slices a file into ordered parts and
 * PUTs each one to its presigned R2 URL with bounded concurrency and per-part
 * retry, reporting progress as parts land. This module is browser-only (it uses
 * fetch + Blob); it must never import the server-only R2 client.
 */

export interface UploadPartPlan {
  /** 1-based part number (S3/R2 multipart parts start at 1). */
  partNumber: number;
  /** Byte offset where this part starts (inclusive). */
  start: number;
  /** Byte offset where this part ends (exclusive). */
  end: number;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface UploadPartsOptions {
  file: Blob;
  /** Presigned PUT URLs in part order: index 0 is part 1. */
  partUrls: string[];
  partSize: number;
  /** Parts uploaded at once. */
  concurrency?: number;
  /** Extra attempts per part after the first (so 3 means up to 4 tries). */
  maxRetries?: number;
  /** Base backoff between retries; grows linearly per attempt. */
  retryDelayMs?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

/** Split a file of `size` bytes into ordered multipart segments. */
export function planParts(size: number, partSize: number): UploadPartPlan[] {
  if (size <= 0 || partSize <= 0) return [];
  const plans: UploadPartPlan[] = [];
  let start = 0;
  let partNumber = 1;
  while (start < size) {
    const end = Math.min(start + partSize, size);
    plans.push({ partNumber, start, end });
    start = end;
    partNumber += 1;
  }
  return plans;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function abortError(): DOMException {
  return new DOMException("Upload aborted", "AbortError");
}

/** PUT one part, retrying transient failures; returns the part's ETag. */
async function putPart(
  url: string,
  body: Blob,
  maxRetries: number,
  retryDelayMs: number,
  signal?: AbortSignal,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw abortError();
    try {
      // Parts carry no signed Content-Type, so we send only the raw bytes.
      const res = await fetch(url, { method: "PUT", body, signal });
      if (!res.ok) throw new Error(`Part upload failed (HTTP ${res.status})`);
      const etag = res.headers.get("ETag");
      if (!etag) throw new Error("Part response is missing its ETag header");
      return etag;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (attempt < maxRetries) await delay(retryDelayMs * (attempt + 1), signal);
    }
  }
  throw lastError ?? new Error("Part upload failed");
}

/**
 * Upload every part with bounded concurrency and per-part retry. Resolves with
 * the parts (in part-number order) once all have succeeded; rejects on abort or
 * once a part exhausts its retries.
 */
export async function uploadParts(
  options: UploadPartsOptions,
): Promise<UploadedPart[]> {
  const { file, partUrls, partSize, signal, onProgress } = options;
  const concurrency = options.concurrency ?? 3;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 250;

  const plans = planParts(file.size, partSize);
  if (plans.length !== partUrls.length) {
    throw new Error("Part plan does not match the presigned part URLs");
  }

  const results: UploadedPart[] = new Array(plans.length);
  let completed = 0;
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= plans.length) return;
      const plan = plans[index];
      const body = file.slice(plan.start, plan.end);
      const etag = await putPart(
        partUrls[index],
        body,
        maxRetries,
        retryDelayMs,
        signal,
      );
      results[index] = { partNumber: plan.partNumber, etag };
      completed += 1;
      onProgress?.(completed, plans.length);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, plans.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
