import { signValue, signatureMatches } from "@/lib/iot/crypto";

const MAX_CURSOR_LENGTH = 512;

export interface EventCursor {
  createdAt: Date;
  id: string;
}

export class InvalidEventCursorError extends Error {
  constructor() {
    super("The event cursor is invalid");
    this.name = "InvalidEventCursorError";
  }
}

export function encodeEventCursor(cursor: EventCursor, pepper: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      t: cursor.createdAt.getTime(),
      i: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${signValue(payload, pepper)}`;
}

export function decodeEventCursor(
  encoded: string,
  pepper: string,
): EventCursor {
  if (!encoded || encoded.length > MAX_CURSOR_LENGTH) {
    throw new InvalidEventCursorError();
  }
  const parts = encoded.split(".");
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1] ||
    !signatureMatches(parts[0], parts[1], pepper)
  ) {
    throw new InvalidEventCursorError();
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8"),
    ) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("v" in parsed) ||
      parsed.v !== 1 ||
      !("t" in parsed) ||
      typeof parsed.t !== "number" ||
      !Number.isSafeInteger(parsed.t) ||
      !("i" in parsed) ||
      typeof parsed.i !== "string" ||
      parsed.i.length > 64
    ) {
      throw new InvalidEventCursorError();
    }
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime())) throw new InvalidEventCursorError();
    return { createdAt, id: parsed.i };
  } catch (error) {
    if (error instanceof InvalidEventCursorError) throw error;
    throw new InvalidEventCursorError();
  }
}

export function clampCursorToPairing(
  cursor: EventCursor,
  pairedAt: Date,
): EventCursor {
  return cursor.createdAt < pairedAt ? { createdAt: pairedAt, id: "" } : cursor;
}
