import type { NextRequest } from "next/server";
import {
  deviceError,
  deviceJson,
  parseBearerToken,
  unauthorizedDevice,
} from "@/lib/iot/http";
import {
  DeviceApiDisabledError,
  authenticateDeviceToken,
  getDeviceConfig,
} from "@/lib/iot/service";

export async function GET(request: NextRequest) {
  const token = parseBearerToken(request);
  if (!token) return unauthorizedDevice();

  try {
    const device = await authenticateDeviceToken(token);
    if (!device) return unauthorizedDevice(true);
    return deviceJson(await getDeviceConfig(device));
  } catch (error) {
    if (error instanceof DeviceApiDisabledError) {
      return deviceError(
        503,
        "DEVICE_API_DISABLED",
        "The device API is not available",
      );
    }
    console.error("Device config failed", {
      errorName: error?.constructor?.name,
    });
    return deviceError(
      503,
      "CONFIG_UNAVAILABLE",
      "Device configuration is temporarily unavailable",
    );
  }
}
