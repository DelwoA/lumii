import { PrismaClient } from "@prisma/client";
import { localDateString } from "../lib/timetable/dates";

const prisma = new PrismaClient();
const SOURCE = "iot_qa_fixture";
const PREFIX = "iot-qa:";
const SESSION_TITLE = "IoT QA active session";
const REMINDER_TITLE = "IoT QA reminder";

function command(): "seed" | "inspect" | "cleanup" {
  const value = process.argv[2];
  if (!["seed", "inspect", "cleanup"].includes(value ?? "")) {
    throw new Error("Use: pnpm iot:qa <seed|inspect|cleanup> --confirm-qa");
  }
  if (!process.argv.includes("--confirm-qa")) {
    throw new Error("Add --confirm-qa to confirm this is the QA account");
  }
  return value as "seed" | "inspect" | "cleanup";
}

async function qaUser() {
  const email = process.env.IOT_QA_USER_EMAIL?.trim().toLowerCase();
  if (email && !email.includes("+clerk_test@")) {
    throw new Error(
      "IOT_QA_USER_EMAIL must identify a dedicated Clerk test account",
    );
  }
  const users = await prisma.user.findMany({
    where: {
      email: email
        ? { equals: email, mode: "insensitive" }
        : { contains: "+clerk_test@", mode: "insensitive" },
    },
    select: { id: true, timezone: true },
    take: 2,
  });
  if (users.length !== 1) {
    throw new Error(
      "Expected exactly one dedicated Clerk test account. Set IOT_QA_USER_EMAIL if needed.",
    );
  }
  return users[0];
}

async function cleanup(userId: string) {
  const [events, sessions, reminders, moods] = await prisma.$transaction([
    prisma.activityEvent.deleteMany({
      where: {
        userId,
        OR: [
          { sourceType: SOURCE },
          { idempotencyKey: { startsWith: PREFIX } },
        ],
      },
    }),
    prisma.studySession.deleteMany({
      where: { userId, title: SESSION_TITLE },
    }),
    prisma.scheduledSession.deleteMany({
      where: { userId, title: REMINDER_TITLE },
    }),
    prisma.moodCheckin.deleteMany({
      where: { userId, heading: "IoT QA mood fixture" },
    }),
  ]);
  console.log({
    cleaned: true,
    events: events.count,
    sessions: sessions.count,
    reminders: reminders.count,
    moods: moods.count,
  });
}

async function seed(user: { id: string; timezone: string }) {
  await cleanup(user.id);
  const now = new Date();
  const localDate = localDateString(now, user.timezone || "UTC");
  const open = await prisma.studySession.findFirst({
    where: { userId: user.id, endedAt: null },
    select: { id: true },
  });
  if (!open) {
    await prisma.studySession.create({
      data: {
        userId: user.id,
        title: SESSION_TITLE,
        startedAt: new Date(now.getTime() - 90 * 1000),
        // Keep the fixture open while a tester signs in and pairs a device.
        // The normal browser heartbeat replaces this future guard once loaded.
        lastHeartbeatAt: new Date(now.getTime() + 60 * 60 * 1000),
        targetDurationSec: 25 * 60,
      },
    });
  }

  await prisma.scheduledSession.create({
    data: {
      userId: user.id,
      title: REMINDER_TITLE,
      plannedStart: new Date(now.getTime() + 90 * 1000),
      plannedEnd: new Date(now.getTime() + 30 * 60 * 1000),
      plannedLocalDate: localDate,
      planningTimezone: user.timezone || "UTC",
      targetDurationSec: 25 * 60,
    },
  });

  const fixedEvents = [
    {
      type: "RANK_UP" as const,
      sourceId: "SILVER",
      payload: { fromRank: "BRONZE", toRank: "SILVER" },
    },
    {
      type: "TROPHY_UNLOCKED" as const,
      sourceId: "IOT_QA_TROPHY",
      payload: { code: "IOT_QA_TROPHY" },
    },
    {
      type: "QUIZ_COMPLETED" as const,
      sourceId: "perfect-quiz",
      payload: { correctCount: 10, questionCount: 10 },
    },
    {
      type: "ADHERENT_DAY" as const,
      sourceId: localDate,
      payload: undefined,
    },
    {
      type: "PERFECT_DAY" as const,
      sourceId: localDate,
      payload: undefined,
    },
  ];
  await prisma.activityEvent.createMany({
    data: [
      ...fixedEvents.map((event, index) => ({
        userId: user.id,
        type: event.type,
        sourceType: SOURCE,
        sourceId: event.sourceId,
        payload: event.payload,
        xpDelta: 0,
        idempotencyKey: `${PREFIX}${user.id}:fixed:${index}`,
      })),
      ...Array.from({ length: 21 }, (_, index) => ({
        userId: user.id,
        type: "QUIZ_COMPLETED" as const,
        sourceType: SOURCE,
        sourceId: `pagination-${index}`,
        payload: { correctCount: index % 5, questionCount: 5 },
        xpDelta: 0,
        idempotencyKey: `${PREFIX}${user.id}:pagination:${index}`,
      })),
    ],
  });

  await inspect(user.id);
}

async function inspect(userId: string) {
  const [profile, openSession, reminder, events, devices] = await Promise.all([
    prisma.gamificationProfile.findUnique({
      where: { userId },
      select: { rank: true, totalXp: true, currentStreak: true },
    }),
    prisma.studySession.findFirst({
      where: { userId, endedAt: null },
      select: { id: true, title: true, startedAt: true },
    }),
    prisma.scheduledSession.findFirst({
      where: { userId, title: REMINDER_TITLE },
      select: { id: true, plannedStart: true },
    }),
    prisma.activityEvent.count({ where: { userId, sourceType: SOURCE } }),
    prisma.ioTDevice.count({ where: { userId, revokedAt: null } }),
  ]);
  console.log({
    fixtureReady: true,
    profile: profile ?? { rank: "BRONZE", totalXp: 0, currentStreak: 0 },
    activeSession: openSession,
    reminder,
    fixtureEvents: events,
    activeDevices: devices,
  });
}

async function main() {
  const action = command();
  const user = await qaUser();
  if (action === "cleanup") return cleanup(user.id);
  if (action === "inspect") return inspect(user.id);
  return seed(user);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "QA fixture failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
