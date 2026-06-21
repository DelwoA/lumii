"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import {
  cancelScheduled,
  createScheduled,
  updateScheduled,
  type ScheduledInput,
} from "@/lib/timetable/service";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  subjectId: z.string().min(1).nullable(),
  topicId: z.string().min(1).nullable(),
  goal: z.string().trim().max(500).nullable(),
  startISO: z.string().min(1),
  endISO: z.string().min(1),
  timeZone: z.string().min(1),
});

export type TimetableActionResult = { ok: true } | { ok: false; error: string };

function errorOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

export async function createScheduledSession(
  input: ScheduledInput,
): Promise<TimetableActionResult> {
  const user = await requireDbUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createScheduled(user.id, parsed.data);
    revalidatePath("/timetable");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
}

export async function updateScheduledSession(
  id: string,
  input: ScheduledInput,
): Promise<TimetableActionResult> {
  const user = await requireDbUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await updateScheduled(user.id, id, parsed.data);
    revalidatePath("/timetable");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
}

export async function cancelScheduledSession(
  id: string,
): Promise<TimetableActionResult> {
  const user = await requireDbUser();
  try {
    await cancelScheduled(user.id, id);
    revalidatePath("/timetable");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorOf(e) };
  }
}
