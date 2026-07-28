import type { DeviceEventV1 } from "@/lib/iot/schemas";

interface ActivityEventLike {
  id: string;
  type: string;
  sourceId: string | null;
  payload: unknown;
  createdAt: Date;
}

const RANKS = new Set(["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"]);
const TROPHY_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

export function sanitizeReminderTitle(title: string): string {
  return title
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function hourInTimeZone(date: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  const parsed = Number(hour);
  return Number.isInteger(parsed) ? parsed : 0;
}

export function mapDeviceEvent(event: ActivityEventLike): DeviceEventV1 | null {
  const payload = record(event.payload);
  const occurredAt = event.createdAt.toISOString();

  if (event.type === "RANK_UP") {
    const fromRank = payload?.fromRank;
    const toRank = payload?.toRank;
    if (
      typeof fromRank !== "string" ||
      typeof toRank !== "string" ||
      !RANKS.has(fromRank) ||
      !RANKS.has(toRank) ||
      fromRank === toRank
    ) {
      return null;
    }
    return {
      id: event.id,
      type: "rank_up",
      occurredAt,
      data: { fromRank, toRank },
    };
  }

  if (event.type === "TROPHY_UNLOCKED") {
    const code = payload?.code ?? event.sourceId;
    if (typeof code !== "string" || !TROPHY_CODE.test(code)) return null;
    return {
      id: event.id,
      type: "trophy_unlocked",
      occurredAt,
      data: { code },
    };
  }

  if (event.type === "QUIZ_COMPLETED") {
    const correctCount = nonNegativeInt(payload?.correctCount);
    const questionCount = nonNegativeInt(payload?.questionCount);
    if (
      correctCount === null ||
      questionCount === null ||
      questionCount === 0 ||
      correctCount > questionCount
    ) {
      return null;
    }
    return {
      id: event.id,
      type: "quiz_completed",
      occurredAt,
      data: {
        correctCount,
        questionCount,
        scorePercent: Math.round((correctCount / questionCount) * 10_000) / 100,
        perfect: correctCount === questionCount,
      },
    };
  }

  if (event.type === "ADHERENT_DAY" || event.type === "PERFECT_DAY") {
    const localDate = event.sourceId;
    if (
      typeof localDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(localDate)
    ) {
      return null;
    }
    return {
      id: event.id,
      type: event.type === "ADHERENT_DAY" ? "adherent_day" : "perfect_day",
      occurredAt,
      data: { localDate },
    };
  }

  return null;
}
