// =============================================================================
// FILE: lib/storage/r2.ts
// WHAT THIS FILE DOES:
//   Every operation on the file store (Cloudflare R2) lives here: making the
//   secure short-lived links the browser uses to upload and view files, reading
//   file bytes on the server (to feed the AI), and deleting files.
//
// IMPORTANT IDEAS:
//   - The bucket is PRIVATE. Nobody can reach a file by guessing a web address;
//     access is only through a "presigned URL" (a temporary signed link).
//       * presignUpload / presignUploadPart: links the browser uses to upload.
//       * presignDownload: a link to view a file (used by the PDF viewer).
//   - Object keys look like users/<id>/<random>.<ext>, so files are namespaced
//     per user and the names give nothing away.
//   - Big files use a "multipart" upload: the file is sent in parts and then
//     assembled (createMultipartUpload / completeMultipartUpload / abort...).
//   - getObjectBytes / getObjectHead: read a file (or just its first bytes) on
//     the server, for the AI pipeline and for the file-signature safety check.
//   - deleteObjectsForUser: wipes all of a user's files when they delete their
//     account.
//
// The actual file-signature checks are in ./magic (re-exported at the bottom) so
// they can be tested without this server-only file.
// =============================================================================
import "server-only";
import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { requireServerEnv } from "@/lib/env";
import { createR2Client } from "@/lib/storage/r2-client";

/**
 * Cloudflare R2 access (S3-compatible). The bucket is PRIVATE: clients upload
 * and view via short-lived presigned URLs; the app reads bytes server-side for
 * the AI pipeline. Object keys are opaque and namespaced per user.
 */
let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  const env = requireServerEnv(
    "CLOUDFLARE_R2_ENDPOINT",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  );
  cached = createR2Client({
    endpoint: env.CLOUDFLARE_R2_ENDPOINT,
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  });
  return cached;
}

function bucket(): string {
  return requireServerEnv("CLOUDFLARE_R2_BUCKET").CLOUDFLARE_R2_BUCKET;
}

/** Opaque per-user object key: users/<internalId>/<uuid>.<ext> */
export function objectKey(userId: string, ext: string): string {
  const safeExt = ext
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toLowerCase();
  return `users/${userId}/${randomUUID()}${safeExt ? "." + safeExt : ""}`;
}

export function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 120,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn },
  );
}

/**
 * Begin a multipart upload. Returns the R2 upload id that ties the parts
 * together; the caller presigns one PUT per part and later completes (or
 * aborts) the upload with this id.
 */
export async function createMultipartUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const res = await client().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
  );
  if (!res.UploadId) throw new Error("R2 did not return an UploadId");
  return res.UploadId;
}

/**
 * Presign a single part PUT. Parts carry no content type (only the completed
 * object does), so nothing beyond the part number is signed; the browser sends
 * the raw bytes. The expiry is generous because a large upload over a slow link
 * can take several minutes.
 */
export function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    client(),
    new UploadPartCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn },
  );
}

/** Assemble the uploaded parts into the final object (parts sorted by number). */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
): Promise<void> {
  const Parts = [...parts]
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }));
  await client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts },
    }),
  );
}

/** Discard an in-progress multipart upload so R2 does not retain its parts. */
export async function abortMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  await client().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
    }),
  );
}

export function presignDownload(key: string, expiresIn = 300): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn },
  );
}

export async function headObject(
  key: string,
): Promise<{ size: number; contentType?: string } | null> {
  try {
    const res = await client().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return { size: res.ContentLength ?? 0, contentType: res.ContentType };
  } catch {
    return null;
  }
}

/** Read the first `bytes` of an object (for magic-byte validation). */
export async function getObjectHead(
  key: string,
  bytes: number,
): Promise<Uint8Array | null> {
  try {
    const res = await client().send(
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      }),
    );
    return (await res.Body?.transformToByteArray()) ?? null;
  } catch {
    return null;
  }
}

/** Read the whole object (used to feed the file to the multimodal AI model). */
export async function getObjectBytes(key: string): Promise<Uint8Array | null> {
  try {
    const res = await client().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return (await res.Body?.transformToByteArray()) ?? null;
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: [{ Key: key }] },
    }),
  );
}

/** Delete every object under a user's namespace (account-deletion saga). */
export async function deleteObjectsForUser(userId: string): Promise<void> {
  const prefix = `users/${userId}/`;
  let token: string | undefined;
  do {
    const list = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const objects = (list.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k))
      .map((Key) => ({ Key }));
    if (objects.length > 0) {
      await client().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: objects },
        }),
      );
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
}

// Magic-byte (file signature) checks live in ./magic so they can be unit-tested
// without importing this server-only module.
export {
  isPdfMagic,
  isPngMagic,
  isJpegMagic,
  isWebpMagic,
  matchesMagic,
} from "./magic";
