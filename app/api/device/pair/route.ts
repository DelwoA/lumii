import type { NextRequest } from "next/server";
import { deviceError, deviceJson, readSmallJson } from "@/lib/iot/http";
import { pairDeviceInputSchema } from "@/lib/iot/schemas";
import {
  DeviceApiDisabledError,
  DeviceLimitError,
  InvalidPairingCodeError,
  PairingRateLimitedError,
  pairDevice,
} from "@/lib/iot/service";

export async function POST(request: NextRequest) {
  try {
    const body = await readSmallJson(request);
    const parsed = pairDeviceInputSchema.safeParse(body);
    if (!parsed.success) {
      return deviceError(
        400,
        "INVALID_REQUEST",
        parsed.error.issues[0]?.message ?? "Invalid pairing request",
      );
    }
    const requestSource =
      request.headers.get("x-forwarded-for")?.trim() || "unknown";
    return deviceJson(await pairDevice(parsed.data.pairingCode, requestSource));
  } catch (error) {
    if (error instanceof PairingRateLimitedError) {
      return deviceError(
        429,
        "RATE_LIMITED",
        "Too many pairing attempts. Try again later.",
        { "Retry-After": String(error.retryAfterSec) },
      );
    }
    if (error instanceof InvalidPairingCodeError) {
      return deviceError(
        400,
        "INVALID_PAIRING_CODE",
        "The pairing code is invalid or unavailable",
      );
    }
    if (error instanceof DeviceLimitError) {
      return deviceError(
        409,
        "DEVICE_LIMIT_REACHED",
        "This account already has three active devices",
      );
    }
    if (error instanceof DeviceApiDisabledError) {
      return deviceError(
        503,
        "DEVICE_API_DISABLED",
        "The device API is not available",
      );
    }
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return deviceError(400, "INVALID_REQUEST", "Send a valid JSON request");
    }
    if (error instanceof RangeError) {
      return deviceError(413, "REQUEST_TOO_LARGE", "The request is too large");
    }
    console.error("Device pairing failed", {
      errorName: error?.constructor?.name,
    });
    return deviceError(
      503,
      "PAIRING_UNAVAILABLE",
      "Device pairing is temporarily unavailable",
    );
  }
}
