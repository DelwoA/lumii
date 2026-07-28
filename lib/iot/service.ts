import "server-only";

import { Prisma, type IoTDevice, type Rank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env, requireServerEnv } from "@/lib/env";
import { getActiveSession } from "@/lib/sessions/service";
import { isValidTimeZone, localDateString } from "@/lib/timetable/dates";
import {
  IOT_API_VERSION,
  IOT_EVENT_TYPES,
  IOT_LAST_SEEN_WRITE_INTERVAL_MS,
  IOT_MAX_ACTIVE_DEVICES,
  IOT_MAX_EVENTS_PER_PAGE,
  IOT_PAIRING_ATTEMPTS_PER_WINDOW,
  IOT_PAIRING_CODE_TTL_MS,
  IOT_PAIRING_WINDOW_MS,
  IOT_POLL_INTERVAL_SEC,
  IOT_REMINDER_WINDOW_MS,
} from "@/lib/iot/constants";
import {
  clampCursorToPairing,
  decodeEventCursor,
  encodeEventCursor,
  InvalidEventCursorError,
  type EventCursor,
} from "@/lib/iot/cursor";
import {
  digestCredential,
  generateDeviceToken,
  generatePairingCode,
} from "@/lib/iot/crypto";
import {
  hourInTimeZone,
  mapDeviceEvent,
  sanitizeReminderTitle,
} from "@/lib/iot/projection";
import {
  cleanupExpiredPairingCodes,
  pairingCodeGenerationLimitReached,
} from "@/lib/iot/pairing-retention";
import type {
  DeviceStatusV1,
  DeviceView,
  UpdateDeviceInput,
} from "@/lib/iot/schemas";

export class DeviceApiDisabledError extends Error {}
export class InvalidPairingCodeError extends Error {}
export class PairingRateLimitedError extends Error {
  retryAfterSec: number;
  constructor(retryAfterSec: number) {
    super("Too many pairing attempts");
    this.retryAfterSec = retryAfterSec;
  }
}
export class PairingCodeLimitError extends Error {}
export class DeviceLimitError extends Error {}

function assertDeviceApiEnabled() {
  if (!env.IOT_DEVICE_API_ENABLED) throw new DeviceApiDisabledError();
}

function authPepper(): string {
  const pepper = requireServerEnv("DEVICE_AUTH_PEPPER").DEVICE_AUTH_PEPPER;
  if (pepper.length < 32) {
    throw new Error("DEVICE_AUTH_PEPPER must contain at least 32 characters");
  }
  return pepper;
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

async function withSerializableRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isWriteConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Transaction retry exhausted");
}

export function isDeviceApiEnabled(): boolean {
  return env.IOT_DEVICE_API_ENABLED;
}

export async function listDevices(userId: string): Promise<DeviceView[]> {
  const devices = await prisma.ioTDevice.findMany({
    where: { userId, revokedAt: null },
    orderBy: { pairedAt: "asc" },
    select: {
      id: true,
      name: true,
      brightness: true,
      volume: true,
      moodNudgeEnabled: true,
      pairedAt: true,
      lastSeenAt: true,
    },
  });
  const onlineCutoff = Date.now() - 90_000;
  return devices.map((device) => ({
    id: device.id,
    name: device.name,
    brightness: device.brightness,
    volume: device.volume,
    moodNudgeEnabled: device.moodNudgeEnabled,
    pairedAtISO: device.pairedAt.toISOString(),
    lastSeenAtISO: device.lastSeenAt?.toISOString() ?? null,
    online:
      device.lastSeenAt !== null && device.lastSeenAt.getTime() >= onlineCutoff,
  }));
}

export async function createDevicePairingCode(
  userId: string,
): Promise<{ pairingCode: string; expiresAtISO: string }> {
  assertDeviceApiEnabled();
  const now = new Date();
  const [, activeDevices] = await Promise.all([
    cleanupExpiredPairingCodes(now, (cutoff) =>
      prisma.ioTDevicePairingCode.deleteMany({
        where: { expiresAt: { lt: cutoff } },
      }),
    ),
    prisma.ioTDevice.count({
      where: { userId, revokedAt: null },
    }),
  ]);
  if (activeDevices >= IOT_MAX_ACTIVE_DEVICES) throw new DeviceLimitError();

  const recentCodes = await prisma.ioTDevicePairingCode.count({
    where: {
      userId,
      createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });
  if (pairingCodeGenerationLimitReached(recentCodes)) {
    throw new PairingCodeLimitError();
  }

  const expiresAt = new Date(now.getTime() + IOT_PAIRING_CODE_TTL_MS);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pairingCode = generatePairingCode();
    const codeDigest = digestCredential(
      "pairing-code",
      pairingCode,
      authPepper(),
    );
    try {
      await prisma.$transaction([
        prisma.ioTDevicePairingCode.updateMany({
          where: {
            userId,
            consumedAt: null,
            expiresAt: { gt: now },
          },
          data: { consumedAt: now },
        }),
        prisma.ioTDevicePairingCode.create({
          data: { userId, codeDigest, expiresAt },
        }),
      ]);
      return { pairingCode, expiresAtISO: expiresAt.toISOString() };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Could not generate a unique pairing code");
}

async function enforcePairingRateLimit(
  source: string,
  now: Date,
): Promise<void> {
  const windowMs =
    Math.floor(now.getTime() / IOT_PAIRING_WINDOW_MS) * IOT_PAIRING_WINDOW_MS;
  const windowStart = new Date(windowMs);
  const expiresAt = new Date(windowMs + IOT_PAIRING_WINDOW_MS * 2);
  const keyDigest = digestCredential(
    "pairing-source",
    source || "unknown",
    authPepper(),
  );

  const [, limit] = await Promise.all([
    prisma.ioTDevicePairingRateLimit.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.ioTDevicePairingRateLimit.upsert({
      where: { keyDigest_windowStart: { keyDigest, windowStart } },
      create: { keyDigest, windowStart, expiresAt, attempts: 1 },
      update: { attempts: { increment: 1 }, expiresAt },
    }),
  ]);
  if (limit.attempts > IOT_PAIRING_ATTEMPTS_PER_WINDOW) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((windowMs + IOT_PAIRING_WINDOW_MS - now.getTime()) / 1000),
    );
    throw new PairingRateLimitedError(retryAfterSec);
  }
}

export async function pairDevice(
  pairingCode: string,
  requestSource: string,
): Promise<{
  apiVersion: "1";
  deviceId: string;
  deviceToken: string;
  eventCursor: string;
}> {
  assertDeviceApiEnabled();
  const now = new Date();
  await enforcePairingRateLimit(requestSource, now);

  const pepper = authPepper();
  const codeDigest = digestCredential("pairing-code", pairingCode, pepper);
  const deviceToken = generateDeviceToken();
  const tokenDigest = digestCredential("device-token", deviceToken, pepper);

  const device = await withSerializableRetry(async (tx) => {
    const code = await tx.ioTDevicePairingCode.findUnique({
      where: { codeDigest },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        consumedAt: true,
      },
    });
    if (!code || code.consumedAt || code.expiresAt <= now) {
      throw new InvalidPairingCodeError();
    }

    const deviceCount = await tx.ioTDevice.count({
      where: { userId: code.userId, revokedAt: null },
    });
    if (deviceCount >= IOT_MAX_ACTIVE_DEVICES) throw new DeviceLimitError();

    const consumed = await tx.ioTDevicePairingCode.updateMany({
      where: {
        id: code.id,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });
    if (consumed.count !== 1) throw new InvalidPairingCodeError();

    return tx.ioTDevice.create({
      data: {
        userId: code.userId,
        name:
          deviceCount === 0
            ? "LUMII Desk Companion"
            : `LUMII Desk Companion ${deviceCount + 1}`,
        tokenDigest,
      },
    });
  });

  return {
    apiVersion: IOT_API_VERSION,
    deviceId: device.id,
    deviceToken,
    eventCursor: encodeEventCursor(
      { createdAt: device.pairedAt, id: "" },
      pepper,
    ),
  };
}

export async function authenticateDeviceToken(
  token: string,
): Promise<IoTDevice | null> {
  assertDeviceApiEnabled();
  if (!token.startsWith("lumii_dev_") || token.length > 128) return null;
  const tokenDigest = digestCredential("device-token", token, authPepper());
  const device = await prisma.ioTDevice.findFirst({
    where: { tokenDigest, revokedAt: null },
  });
  if (!device) return null;

  const cutoff = new Date(Date.now() - IOT_LAST_SEEN_WRITE_INTERVAL_MS);
  if (!device.lastSeenAt || device.lastSeenAt < cutoff) {
    const now = new Date();
    await prisma.ioTDevice.updateMany({
      where: {
        id: device.id,
        revokedAt: null,
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }],
      },
      data: { lastSeenAt: now },
    });
    return { ...device, lastSeenAt: now };
  }
  return device;
}

export async function getDeviceConfig(device: IoTDevice) {
  return {
    apiVersion: IOT_API_VERSION,
    deviceId: device.id,
    serverTime: new Date().toISOString(),
    pollIntervalSec: IOT_POLL_INTERVAL_SEC,
    brightness: device.brightness,
    volume: device.volume,
    moodNudgeEnabled: device.moodNudgeEnabled,
    updatedAt: device.updatedAt.toISOString(),
  };
}

function isTodayInTimeZone(date: Date, now: Date, timeZone: string): boolean {
  return localDateString(date, timeZone) === localDateString(now, timeZone);
}

function eventWhereAfter(userId: string, cursor: EventCursor) {
  return {
    userId,
    type: { in: [...IOT_EVENT_TYPES] },
    OR: [
      { createdAt: { gt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { gt: cursor.id } },
    ],
  } satisfies Prisma.ActivityEventWhereInput;
}

export async function getDeviceStatus(
  device: IoTDevice,
  encodedCursor: string | null,
): Promise<DeviceStatusV1> {
  const now = new Date();
  const pepper = authPepper();
  const requestedCursor = encodedCursor
    ? decodeEventCursor(encodedCursor, pepper)
    : { createdAt: device.pairedAt, id: "" };
  if (requestedCursor.createdAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new InvalidEventCursorError();
  }
  const cursor = clampCursorToPairing(requestedCursor, device.pairedAt);

  const activePromise = getActiveSession(device.userId);
  const [profile, user, reminder, recentMood, rawEvents] = await Promise.all([
    prisma.gamificationProfile.findUnique({
      where: { userId: device.userId },
      select: { rank: true, totalXp: true, currentStreak: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: device.userId },
      select: { timezone: true },
    }),
    prisma.scheduledSession.findFirst({
      where: {
        userId: device.userId,
        status: "PLANNED",
        plannedStart: {
          gte: now,
          lte: new Date(now.getTime() + IOT_REMINDER_WINDOW_MS),
        },
      },
      orderBy: { plannedStart: "asc" },
      select: { id: true, title: true, plannedStart: true },
    }),
    prisma.moodCheckin.findMany({
      where: {
        userId: device.userId,
        createdAt: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { createdAt: true },
    }),
    prisma.activityEvent.findMany({
      where: eventWhereAfter(device.userId, cursor),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: IOT_MAX_EVENTS_PER_PAGE + 1,
      select: {
        id: true,
        type: true,
        sourceId: true,
        payload: true,
        createdAt: true,
      },
    }),
  ]);
  const active = await activePromise;

  const pageRows = rawEvents.slice(0, IOT_MAX_EVENTS_PER_PAGE);
  const events = pageRows.map(mapDeviceEvent).filter((event) => event !== null);
  const lastRow = pageRows.at(-1);
  const nextCursor = lastRow
    ? { createdAt: lastRow.createdAt, id: lastRow.id }
    : cursor;
  const timeZone = isValidTimeZone(user.timezone) ? user.timezone : "UTC";
  const hasMoodToday = recentMood.some((mood) =>
    isTodayInTimeZone(mood.createdAt, now, timeZone),
  );
  const rank: Rank = profile?.rank ?? "BRONZE";

  return {
    apiVersion: IOT_API_VERSION,
    deviceId: device.id,
    serverTime: now.toISOString(),
    rank,
    totalXp: profile?.totalXp ?? 0,
    currentStreak: profile?.currentStreak ?? 0,
    activeSession: active
      ? {
          id: active.id,
          startedAt: new Date(active.startedAtMs).toISOString(),
          elapsedSec: Math.max(
            0,
            Math.floor((now.getTime() - active.startedAtMs) / 1000),
          ),
        }
      : null,
    rankUp: events.some((event) => event.type === "rank_up"),
    upcomingReminder: reminder
      ? {
          id: reminder.id,
          title: sanitizeReminderTitle(reminder.title),
          plannedStart: reminder.plannedStart.toISOString(),
        }
      : null,
    moodCheckinNeeded:
      device.moodNudgeEnabled &&
      hourInTimeZone(now, timeZone) >= 18 &&
      !hasMoodToday,
    events,
    nextCursor: encodeEventCursor(nextCursor, pepper),
    hasMore: rawEvents.length > IOT_MAX_EVENTS_PER_PAGE,
  };
}

export async function updateDevice(
  userId: string,
  input: UpdateDeviceInput,
): Promise<boolean> {
  const result = await prisma.ioTDevice.updateMany({
    where: { id: input.deviceId, userId, revokedAt: null },
    data: {
      name: input.name,
      brightness: input.brightness,
      volume: input.volume,
      moodNudgeEnabled: input.moodNudgeEnabled,
    },
  });
  return result.count === 1;
}

export async function unpairDevice(
  userId: string,
  deviceId: string,
): Promise<"revoked" | "already-revoked" | "not-found"> {
  const existing = await prisma.ioTDevice.findFirst({
    where: { id: deviceId, userId },
    select: { revokedAt: true },
  });
  if (!existing) return "not-found";
  if (existing.revokedAt) return "already-revoked";
  await prisma.ioTDevice.updateMany({
    where: { id: deviceId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return "revoked";
}
