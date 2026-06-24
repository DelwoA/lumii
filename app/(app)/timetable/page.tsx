// =============================================================================
// FILE: app/(app)/timetable/page.tsx   ->   web address: /timetable
// WHAT THIS FILE DOES:
//   The Timetable page. It loads the student's planned sessions and subject list
//   on the server, then hands them to the interactive TimetableClient component
//   (month/week views and the create/edit form). Splitting it this way keeps the
//   data-loading on the server and the clicking/typing in the browser.
// =============================================================================
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listScheduled } from "@/lib/timetable/service";
import { TimetableClient } from "@/components/timetable/timetable-client";
import type { SubjectOption } from "@/lib/timetable/types";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function TimetablePage() {
  const user = await requireDbUser();
  const now = Date.now();
  // A generous planning window keeps the page light while covering recent
  // history and near-future planning.
  const fromISO = new Date(now - 31 * DAY_MS).toISOString();
  const toISO = new Date(now + 92 * DAY_MS).toISOString();

  const [sessions, subjectsRaw] = await Promise.all([
    listScheduled(user.id, fromISO, toISO),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { name: "asc" },
      include: {
        topics: {
          where: { archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const subjects: SubjectOption[] = subjectsRaw.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    topics: s.topics,
  }));

  return <TimetableClient sessions={sessions} subjects={subjects} />;
}
