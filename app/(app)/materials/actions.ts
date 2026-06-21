"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  requestUploadInput,
  noteInput,
  MAX_FILE_BYTES,
  type RequestUploadInput,
} from "@/lib/validations/material";
import {
  objectKey,
  presignUpload,
  headObject,
  getObjectHead,
  isPdfMagic,
  deleteObject,
} from "@/lib/storage/r2";
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

export type RequestUploadResult =
  | { ok: true; materialId: string; uploadUrl: string }
  | { ok: false; error: string };

/** Step 1 of upload: validate, create a PENDING material, return a presigned PUT URL. */
export async function requestUpload(
  input: RequestUploadInput,
): Promise<RequestUploadResult> {
  const user = await requireDbUser();
  const parsed = requestUploadInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid upload" };
  }
  const { title, subjectId, topicId, fileName, contentType, sizeBytes } =
    parsed.data;

  if (!(await assertScopeOwned(user.id, subjectId, topicId))) {
    return { ok: false, error: "Subject or topic not found" };
  }

  const ext = fileName.includes(".") ? fileName.split(".").pop()! : "pdf";
  const key = objectKey(user.id, ext);

  const material = await prisma.material.create({
    data: {
      userId: user.id,
      subjectId,
      topicId,
      title,
      type: "PDF",
      r2Key: key,
      originalName: fileName,
      mimeType: contentType,
      sizeBytes,
      status: "PENDING_UPLOAD",
    },
    select: { id: true },
  });

  const uploadUrl = await presignUpload(key, contentType);
  return { ok: true, materialId: material.id, uploadUrl };
}

/** Step 2 of upload: verify the object in R2 (size + PDF magic) and mark READY/FAILED. */
export async function finalizeUpload(materialId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId: user.id, type: "PDF" },
    select: { id: true, r2Key: true },
  });
  if (!material?.r2Key) return fail("Material not found");

  const head = await headObject(material.r2Key);
  const magic = await getObjectHead(material.r2Key, 8);
  const valid =
    head !== null && head.size > 0 && head.size <= MAX_FILE_BYTES && isPdfMagic(magic);

  await prisma.material.update({
    where: { id: material.id },
    data: {
      status: valid ? "READY" : "FAILED",
      sizeBytes: head?.size ?? undefined,
    },
  });
  revalidatePath("/materials");
  return valid ? OK : fail("Uploaded file failed validation");
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
  await prisma.material.create({
    data: {
      userId: user.id,
      subjectId: parsed.data.subjectId,
      topicId: parsed.data.topicId,
      title: parsed.data.title,
      type: "NOTE",
      noteText: parsed.data.text,
      status: "READY",
    },
  });
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
