"use server";

// =============================================================================
// FILE: app/(app)/subjects/actions.ts
// WHAT THIS FILE DOES:
//   Server actions for subjects and topics: create, edit, and delete. Deleting a
//   subject or topic is owner-scoped and deliberately KEEPS the student's
//   materials (the database just clears the link), so no study content is lost.
//   Input is validated with the rules in lib/validations/subject.
// =============================================================================

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subjectInput, topicInput } from "@/lib/validations/subject";
import type { ActionState } from "@/lib/forms";

const OK: ActionState = { ok: true };
function fail(error: string): ActionState {
  return { ok: false, error };
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
  revalidatePath("/subjects");
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
  revalidatePath("/subjects");
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
  revalidatePath("/subjects");
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
  revalidatePath(`/subjects/${subjectId}`);
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
  revalidatePath(`/subjects/${topic.subjectId}`);
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
  revalidatePath(`/subjects/${topic.subjectId}`);
  return OK;
}
