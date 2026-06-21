import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { requireServerEnv } from "@/lib/env";

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
  cached = new S3Client({
    region: "auto",
    endpoint: env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });
  return cached;
}

function bucket(): string {
  return requireServerEnv("CLOUDFLARE_R2_BUCKET").CLOUDFLARE_R2_BUCKET;
}

/** Opaque per-user object key: users/<internalId>/<uuid>.<ext> */
export function objectKey(userId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return `users/${userId}/${randomUUID()}${safeExt ? "." + safeExt : ""}`;
}

export function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 120,
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn },
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
      new GetObjectCommand({ Bucket: bucket(), Key: key, Range: `bytes=0-${bytes - 1}` }),
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
        new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: objects } }),
      );
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
}

/** True if the bytes begin with the PDF magic number (%PDF). */
export function isPdfMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 4) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  );
}
