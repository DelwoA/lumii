import type { NextRequest } from "next/server";
import {
  deviceError,
  deviceJson,
  parseBearerToken,
  unauthorizedDevice,
} from "@/lib/iot/http";
import { InvalidEventCursorError } from "@/lib/iot/cursor";
import {
  DeviceApiDisabledError,
  authenticateDeviceToken,
  getDeviceStatus,
} from "@/lib/iot/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = parseBearerToken(request);
  if (!token) return unauthorizedDevice();

  try {
    const device = await authenticateDeviceToken(token);
    if (!device) return unauthorizedDevice(true);
    const cursor = request.nextUrl.searchParams.get("cursor");
    return deviceJson(await getDeviceStatus(device, cursor));
  } catch (error) {
    if (error instanceof InvalidEventCursorError) {
      return deviceError(400, "INVALID_CURSOR", "The event cursor is invalid");
    }
    if (error instanceof DeviceApiDisabledError) {
      return deviceError(
        503,
        "DEVICE_API_DISABLED",
        "The device API is not available",
      );
    }
    console.error("Device status failed", {
      errorName: error?.constructor?.name,
    });
    return deviceError(
      503,
      "STATUS_UNAVAILABLE",
      "Device status is temporarily unavailable",
    );
  }
}
