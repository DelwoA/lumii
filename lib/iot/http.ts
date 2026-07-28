import { NextResponse } from "next/server";
import { IOT_API_VERSION } from "@/lib/iot/constants";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Authorization",
} as const;

export function deviceJson(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...NO_STORE_HEADERS, ...init.headers },
  });
}

export function deviceError(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>,
) {
  return deviceJson(
    { apiVersion: IOT_API_VERSION, error: { code, message } },
    { status, headers },
  );
}

export function unauthorizedDevice(error = false) {
  const challenge = error
    ? 'Bearer realm="lumii-device", error="invalid_token"'
    : 'Bearer realm="lumii-device"';
  return deviceError(401, "UNAUTHORIZED", "Device authentication failed", {
    "WWW-Authenticate": challenge,
  });
}

export function parseBearerToken(request: Request): string | null {
  const value = request.headers.get("authorization");
  if (!value) return null;
  const match = /^Bearer ([A-Za-z0-9._~+/=-]+)$/.exec(value);
  return match?.[1] ?? null;
}

export async function readSmallJson(request: Request, maxBytes = 1024) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim();
  if (contentType !== "application/json") {
    throw new TypeError("Content-Type must be application/json");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new RangeError("Request body is too large");
  }
  return JSON.parse(text) as unknown;
}
