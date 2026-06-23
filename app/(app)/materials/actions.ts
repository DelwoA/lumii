"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MaterialType, MaterialStatus } from "@prisma/client";
import {
  requestUploadInput,
  completeMultipartInput,
  abortMultipartInput,
  noteInput,
  materialTypeForContentType,
  MAX_FILE_BYTES,
  MULTIPART_PART_SIZE,
  type RequestUploadInput,
  type CompleteMultipartInput,
  type AbortMultipartInput,
} from "@/lib/validations/material";
import {
  objectKey,
  presignUpload,
  presignUploadPart,
  createMultipartUpload,
  completeMultipartUpload,
  abortMultipartUpload,
  headObject,
  getObjectHead,
  getObjectBytes,
  matchesMagic,
  deleteObject,
} from "@/lib/storage/r2";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { indexMaterial } from "@/lib/rag/service";
import type { ActionState } from "@/lib/forms";

const OK: ActionState = { ok: true };
function fail(error: string): ActionState {
  return { ok: false, error };
}

/** Ensure an optional subject/topic belongs to the user (derived ownership). */
async function assertScopeOwned(
  userId: string,
  subjectId?: string,
  topicId?: string,
): Promise<boolean> {
  if (subjectId) {
    const s = await prisma.subject.findFirst({
      where: { id: subjectId, userId, archivedAt: null },
      select: { id: true },
    });
    if (!s) return false;
  }
  if (topicId) {
    const t = await prisma.topic.findFirst({
      where: { id: topicId, userId, ...(subjectId ? { subjectId } : {}) },
      select: { id: true },
    });
    if (!t) return false;
  }
  return true;
}

/** Only file materials (not notes) participate in the R2 upload flow. */
const FILE_TYPES: MaterialType[] = ["PDF", "IMAGE", "AUDIO"];

/** Opaque per-user object key derived from the original file name's extension. */
function fileKeyFor(userId: string, fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()! : "";
  return objectKey(userId, ext);
}

/** Create the PENDING_UPLOAD file row (PDF or image) for a pre-allocated key. */
async function createPendingFile(
  userId: string,
  key: string,
  type: MaterialType,
  data: RequestUploadInput,
): Promise<string> {
  const material = await prisma.material.create({
    data: {
      userId,
      subjectId: data.subjectId,
      topicId: data.topicId,
      title: data.title,
      type,
      r2Key: key,
      originalName: data.fileName,
      mimeType: data.contentType,
      sizeBytes: data.sizeBytes,
      status: "PENDING_UPLOAD",
    },
    select: { id: true },
  });
  return material.id;
}

/**
 * Verify an uploaded object is non-empty, in-bounds, and actually the declared
 * file type (magic-byte check via a ranged GET; 12 bytes covers PDF + images).
 */
async function verifyFileObject(
  r2Key: string,
  mimeType: string | null,
): Promise<{ valid: boolean; size: number }> {
  const head = await headObject(r2Key);
  const magic = await getObjectHead(r2Key, 12);
  const size = head?.size ?? 0;
  const valid =
    head !== null &&
    size > 0 &&
    size <= MAX_FILE_BYTES &&
    matchesMagic(mimeType ?? "", magic);
  return { valid, size };
}

/**
 * Mark a material from a verification result and revalidate. A valid file
 * becomes READY, except audio, which becomes TRANSCRIBING (its transcript is
 * produced by a follow-up call before it is usable).
 */
async function markVerified(
  materialId: string,
  type: MaterialType,
  result: { valid: boolean; size: number },
): Promise<ActionState> {
  const validStatus: MaterialStatus = type === "AUDIO" ? "TRANSCRIBING" : "READY";
  await prisma.material.update({
    where: { id: materialId },
    data: {
      status: result.valid ? validStatus : "FAILED",
      sizeBytes: result.size || undefined,
    },
  });
  revalidatePath("/materials");
  return result.valid ? OK : fail("Uploaded file failed validation");
}

export type RequestUploadResult =
  | { ok: true; materialId: string; uploadUrl: string }
  | { ok: false; error: string };

/** Single-PUT path (small files): create a PENDING material + presigned PUT URL. */
export async function requestUpload(
  input: RequestUploadInput,
): Promise<RequestUploadResult> {
  const user = await requireDbUser();
  const parsed = requestUploadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload" };
  }
  const { subjectId, topicId, fileName, contentType } = parsed.data;

  if (!(await assertScopeOwned(user.id, subjectId, topicId))) {
    return { ok: false, error: "Subject or topic not found" };
  }

  const type = materialTypeForContentType(contentType);
  if (!type) return { ok: false, error: "Unsupported file type" };

  const key = fileKeyFor(user.id, fileName);
  const materialId = await createPendingFile(user.id, key, type, parsed.data);
  const uploadUrl = await presignUpload(key, contentType);
  return { ok: true, materialId, uploadUrl };
}

export type StartMultipartResult =
  | {
      ok: true;
      materialId: string;
      uploadId: string;
      partUrls: string[];
      partSize: number;
    }
  | { ok: false; error: string };

/**
 * Multipart path (large files): begin the R2 upload, presign one PUT per part,
 * and only then create the PENDING material so a failed R2 setup leaves no
 * orphan row. The client uploads the parts and calls completeUpload/abortUpload.
 */
export async function startMultipartUpload(
  input: RequestUploadInput,
): Promise<StartMultipartResult> {
  const user = await requireDbUser();
  const parsed = requestUploadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload" };
  }
  const { subjectId, topicId, fileName, contentType, sizeBytes } = parsed.data;

  if (!(await assertScopeOwned(user.id, subjectId, topicId))) {
    return { ok: false, error: "Subject or topic not found" };
  }

  const type = materialTypeForContentType(contentType);
  if (!type) return { ok: false, error: "Unsupported file type" };

  const key = fileKeyFor(user.id, fileName);
  const partCount = Math.max(1, Math.ceil(sizeBytes / MULTIPART_PART_SIZE));

  let uploadId: string;
  try {
    uploadId = await createMultipartUpload(key, contentType);
  } catch {
    return { ok: false, error: "Could not start the upload. Please try again." };
  }

  let partUrls: string[];
  try {
    partUrls = await Promise.all(
      Array.from({ length: partCount }, (_, i) =>
        presignUploadPart(key, uploadId, i + 1),
      ),
    );
  } catch {
    await abortMultipartUpload(key, uploadId).catch(() => {});
    return { ok: false, error: "Could not start the upload. Please try again." };
  }

  const materialId = await createPendingFile(user.id, key, type, parsed.data);
  return { ok: true, materialId, uploadId, partUrls, partSize: MULTIPART_PART_SIZE };
}

/** Complete a multipart upload, then verify + mark the material READY/FAILED. */
export async function completeUpload(
  input: CompleteMultipartInput,
): Promise<ActionState> {
  const user = await requireDbUser();
  const parsed = completeMultipartInput.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const { materialId, uploadId, parts } = parsed.data;

  const material = await prisma.material.findFirst({
    where: { id: materialId, userId: user.id, type: { in: FILE_TYPES } },
    select: { id: true, type: true, r2Key: true, mimeType: true },
  });
  if (!material?.r2Key) return fail("Material not found");

  try {
    await completeMultipartUpload(material.r2Key, uploadId, parts);
  } catch {
    return fail("Could not finish the upload. Please try again.");
  }

  return markVerified(
    material.id,
    material.type,
    await verifyFileObject(material.r2Key, material.mimeType),
  );
}

/** Abandon an in-progress multipart upload: abort in R2 and drop the row. */
export async function abortUpload(
  input: AbortMultipartInput,
): Promise<ActionState> {
  const user = await requireDbUser();
  const parsed = abortMultipartInput.safeParse(input);
  if (!parsed.success) return fail("Invalid request");
  const { materialId, uploadId } = parsed.data;

  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      userId: user.id,
      type: { in: FILE_TYPES },
      status: "PENDING_UPLOAD",
    },
    select: { id: true, r2Key: true },
  });
  if (!material?.r2Key) return OK; // Already cleaned up; abort is idempotent.

  await abortMultipartUpload(material.r2Key, uploadId).catch(() => {});
  await prisma.material.delete({ where: { id: material.id } }).catch(() => {});
  revalidatePath("/materials");
  return OK;
}

/** Single-PUT finalize: verify the object in R2 and mark READY/FAILED. */
export async function finalizeUpload(materialId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId: user.id, type: { in: FILE_TYPES } },
    select: { id: true, type: true, r2Key: true, mimeType: true },
  });
  if (!material?.r2Key) return fail("Material not found");

  return markVerified(
    material.id,
    material.type,
    await verifyFileObject(material.r2Key, material.mimeType),
  );
}

/**
 * Transcribe an uploaded audio material with the model and mark it READY. Used
 * both right after upload and as a retry from the material page (e.g. if the
 * first attempt was interrupted). Runs in one server call, so it relies on the
 * client-side length cap to stay within the function budget.
 */
export async function transcribeAudioAction(
  materialId: string,
): Promise<ActionState> {
  const user = await requireDbUser();
  const material = await prisma.material.findFirst({
    where: {
      id: materialId,
      userId: user.id,
      type: "AUDIO",
      status: { in: ["TRANSCRIBING", "FAILED"] },
    },
    select: { id: true, r2Key: true, mimeType: true },
  });
  if (!material?.r2Key) return fail("Audio not found");

  // Mark transcribing (covers a retry from FAILED) before the slow model call.
  await prisma.material.update({
    where: { id: material.id },
    data: { status: "TRANSCRIBING" },
  });

  const bytes = await getObjectBytes(material.r2Key);
  if (!bytes) {
    await prisma.material.update({
      where: { id: material.id },
      data: { status: "FAILED" },
    });
    return fail("Could not read the audio file");
  }

  try {
    const { text } = await transcribeAudio({
      fileBytes: bytes,
      mimeType: material.mimeType ?? "audio/mpeg",
    });
    if (!text) throw new Error("Empty transcript");
    await prisma.material.update({
      where: { id: material.id },
      data: { status: "READY", transcript: text },
    });
    // Best-effort: index the transcript so the tutor can use RAG on the audio.
    try {
      await indexMaterial(material.id, user.id, text);
    } catch {
      // Indexing is non-critical; the transcript is still usable without it.
    }
    revalidatePath("/materials");
    revalidatePath(`/materials/${material.id}`);
    return OK;
  } catch {
    await prisma.material.update({
      where: { id: material.id },
      data: { status: "FAILED" },
    });
    return fail("Could not transcribe the audio. Please try again.");
  }
}

/** Create a typed-note material (no file). */
export async function createNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireDbUser();
  const parsed = noteInput.safeParse({
    title: formData.get("title"),
    subjectId: (formData.get("subjectId") as string) || undefined,
    topicId: (formData.get("topicId") as string) || undefined,
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid note");
  }
  if (
    !(await assertScopeOwned(user.id, parsed.data.subjectId, parsed.data.topicId))
  ) {
    return fail("Subject or topic not found");
  }
  const material = await prisma.material.create({
    data: {
      userId: user.id,
      subjectId: parsed.data.subjectId,
      topicId: parsed.data.topicId,
      title: parsed.data.title,
      type: "NOTE",
      noteText: parsed.data.text,
      status: "READY",
    },
    select: { id: true },
  });
  // Best-effort: build the retrieval index so the tutor can use RAG on the note.
  try {
    await indexMaterial(material.id, user.id, parsed.data.text);
  } catch {
    // Indexing is non-critical; the note is still usable without it.
  }
  revalidatePath("/materials");
  return OK;
}

/** Delete a material: R2 object first (retry-safe), then the DB row (cascades summaries). */
export async function deleteMaterial(materialId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId: user.id },
    select: { id: true, r2Key: true },
  });
  if (!material) return fail("Material not found");

  if (material.r2Key) {
    try {
      await deleteObject(material.r2Key);
    } catch {
      return fail("Could not delete the file. Please try again.");
    }
  }
  await prisma.material.delete({ where: { id: material.id } });
  revalidatePath("/materials");
  return OK;
}
