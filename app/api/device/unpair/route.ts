import { getOrCreateDbUser } from "@/lib/auth";
import { deviceError, deviceJson, readSmallJson } from "@/lib/iot/http";
import { unpairDeviceInputSchema } from "@/lib/iot/schemas";
import { unpairDevice } from "@/lib/iot/service";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(request.url).origin;
  if (!origin || origin !== expectedOrigin) {
    return deviceError(403, "FORBIDDEN", "This request is not allowed");
  }

  const user = await getOrCreateDbUser();
  if (!user) {
    return deviceError(401, "UNAUTHORIZED", "Sign in to unpair a device");
  }

  try {
    const body = await readSmallJson(request);
    const parsed = unpairDeviceInputSchema.safeParse(body);
    if (!parsed.success) {
      return deviceError(400, "INVALID_REQUEST", "Choose a valid device");
    }
    const result = await unpairDevice(user.id, parsed.data.deviceId);
    if (result === "not-found") {
      return deviceError(404, "DEVICE_NOT_FOUND", "Device not found");
    }
    return deviceJson({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return deviceError(400, "INVALID_REQUEST", "Send a valid JSON request");
    }
    if (error instanceof RangeError) {
      return deviceError(413, "REQUEST_TOO_LARGE", "The request is too large");
    }
    console.error("Device unpair failed", {
      errorName: error?.constructor?.name,
    });
    return deviceError(
      503,
      "UNPAIR_UNAVAILABLE",
      "The device could not be unpaired",
    );
  }
}
