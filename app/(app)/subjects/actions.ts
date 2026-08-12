"use server";

// =============================================================================
// FILE: app/(app)/subjects/actions.ts
// WHAT THIS FILE DOES:
//   Server actions for subjects and topics: create, edit, and delete. Deleting a
//   subject or topic is owner-scoped and deliberately KEEPS the student's
//   materials (the database just clears the link), so no study content is lost.
//   Input is validated with the rules in lib/validations/subject.
// =============================================================================

import { revalidatePath, revalidateTag } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subjectInput, topicInput } from "@/lib/validations/subject";
import type { ActionState } from "@/lib/forms";

const OK: ActionState = { ok: true };
function fail(error: string): ActionState {
  return { ok: false, error };
}

function invalidateSubjects(userId: string) {
  revalidateTag(`user:${userId}:subjects`, "max");
}

export type OrganizerActionResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

/** Small, typed actions used by the material organizer's inline controls. */
export async function createOrganizerSubject(input: {
  name: string;
}): Promise<OrganizerActionResult> {
  const user = await requireDbUser();
  const parsed = subjectInput.safeParse({ name: input.name });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid subject",
    };
  }
  const subject = await prisma.subject.create({
    data: { userId: user.id, name: parsed.data.name },
    select: { id: true, name: true },
  });
  revalidatePath("/library");
  invalidateSubjects(user.id);
  return { ok: true, id: subject.id, name: subject.name };
}

export async function createOrganizerTopic(input: {
  subjectId: string;
  name: string;
}): Promise<OrganizerActionResult> {
  const user = await requireDbUser();
  const parsed = topicInput.safeParse({ name: input.name });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid topic",
    };
  }
  const subject = await prisma.subject.findFirst({
    where: { id: input.subjectId, userId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!subject) return { ok: false, error: "Subject not found" };
  const topic = await prisma.topic.create({
    data: { userId: user.id, subjectId: subject.id, name: parsed.data.name },
    select: { id: true, name: true },
  });
  revalidatePath("/library");
  revalidatePath(`/library/subjects/${subject.id}`);
  invalidateSubjects(user.id);
  return { ok: true, id: topic.id, name: topic.name };
}

export async function createSubject(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireDbUser();
  const parsed = subjectInput.safeParse({
    name: formData.get("name"),
    color: (formData.get("color") as string) || undefined,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await prisma.subject.create({
    data: { userId: user.id, name: parsed.data.name, color: parsed.data.color },
  });
  revalidatePath("/library");
  invalidateSubjects(user.id);
  return OK;
}

export async function archiveSubject(subjectId: string): Promise<ActionState> {
  const user = await requireDbUser();
  // updateMany scoped by userId so a user can only archive their own subjects.
  const res = await prisma.subject.updateMany({
    where: { id: subjectId, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (res.count === 0) return fail("Subject not found");
  revalidatePath("/library");
  invalidateSubjects(user.id);
  return OK;
}

export async function renameSubject(
  subjectId: string,
  name: string,
): Promise<ActionState> {
  const user = await requireDbUser();
  const parsed = subjectInput.safeParse({ name });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid name");
  const result = await prisma.subject.updateMany({
    where: { id: subjectId, userId: user.id, archivedAt: null },
    data: { name: parsed.data.name },
  });
  if (!result.count) return fail("Subject not found");
  revalidatePath("/library");
  revalidatePath(`/library/subjects/${subjectId}`);
  invalidateSubjects(user.id);
  return OK;
}

/**
 * Permanently delete a subject. Its topics are removed via the DB cascade and
 * its materials are kept (their subjectId/topicId are set null), so deleting a
 * subject never destroys uploaded materials. Owner-scoped.
 */
export async function deleteSubject(subjectId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const res = await prisma.subject.deleteMany({
    where: { id: subjectId, userId: user.id },
  });
  if (res.count === 0) return fail("Subject not found");
  revalidatePath("/library");
  invalidateSubjects(user.id);
  return OK;
}

export async function createTopic(
  subjectId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireDbUser();
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id, archivedAt: null },
    select: { id: true },
  });
  if (!subject) return fail("Subject not found");

  const parsed = topicInput.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await prisma.topic.create({
    data: { subjectId, userId: user.id, name: parsed.data.name },
  });
  revalidatePath("/library");
  revalidatePath(`/library/subjects/${subjectId}`);
  invalidateSubjects(user.id);
  return OK;
}

export async function archiveTopic(topicId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, userId: user.id },
    select: { subjectId: true },
  });
  if (!topic) return fail("Topic not found");
  await prisma.topic.updateMany({
    where: { id: topicId, userId: user.id },
    data: { archivedAt: new Date() },
  });
  revalidatePath("/library");
  revalidatePath(`/library/subjects/${topic.subjectId}`);
  invalidateSubjects(user.id);
  return OK;
}

export async function renameTopic(
  topicId: string,
  name: string,
): Promise<ActionState> {
  const user = await requireDbUser();
  const parsed = topicInput.safeParse({ name });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid name");
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, userId: user.id, archivedAt: null },
    select: { subjectId: true },
  });
  if (!topic) return fail("Topic not found");
  await prisma.topic.updateMany({
    where: { id: topicId, userId: user.id, archivedAt: null },
    data: { name: parsed.data.name },
  });
  revalidatePath("/library");
  revalidatePath(`/library/subjects/${topic.subjectId}`);
  invalidateSubjects(user.id);
  return OK;
}

/**
 * Permanently delete a topic. Its materials are kept (their topicId is set
 * null). Owner-scoped.
 */
export async function deleteTopic(topicId: string): Promise<ActionState> {
  const user = await requireDbUser();
  const topic = await prisma.topic.findFirst({
    where: { id: topicId, userId: user.id },
    select: { subjectId: true },
  });
  if (!topic) return fail("Topic not found");
  await prisma.topic.deleteMany({ where: { id: topicId, userId: user.id } });
  revalidatePath("/library");
  revalidatePath(`/library/subjects/${topic.subjectId}`);
  invalidateSubjects(user.id);
  return OK;
}
