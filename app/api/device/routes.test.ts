import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidEventCursorError } from "@/lib/iot/cursor";

const service = vi.hoisted(() => {
  class DeviceApiDisabledError extends Error {}
  class DeviceLimitError extends Error {}
  class InvalidPairingCodeError extends Error {}
  class PairingRateLimitedError extends Error {
    constructor(readonly retryAfterSec: number) {
      super("Pairing is rate limited");
    }
  }

  return {
    DeviceApiDisabledError,
    DeviceLimitError,
    InvalidPairingCodeError,
    PairingRateLimitedError,
    authenticateDeviceToken: vi.fn(),
    getDeviceConfig: vi.fn(),
    getDeviceStatus: vi.fn(),
    pairDevice: vi.fn(),
    unpairDevice: vi.fn(),
  };
});

const auth = vi.hoisted(() => ({
  getOrCreateDbUser: vi.fn(),
}));

vi.mock("@/lib/iot/service", () => service);
vi.mock("@/lib/auth", () => auth);

import { GET as getConfig } from "./config/route";
import { POST as pairDevice } from "./pair/route";
import { GET as getStatus } from "./status/route";
import { POST as unpairDevice } from "./unpair/route";

const device = {
  id: "device_123",
  userId: "user_123",
  pairedAt: new Date("2026-07-29T00:00:00.000Z"),
  brightness: 20,
  volume: 40,
  moodNudgeEnabled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("device pairing route", () => {
  it("pairs with a valid JSON request without caching the credential", async () => {
    service.pairDevice.mockResolvedValue({
      apiVersion: "1",
      deviceId: device.id,
      deviceToken: "lumii_dev_example",
      eventCursor: "cursor",
    });

    const response = await pairDevice(
      new NextRequest("https://lumii.example/api/device/pair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "192.0.2.1",
        },
        body: JSON.stringify({ pairingCode: "12345678" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(service.pairDevice).toHaveBeenCalledWith("12345678", "192.0.2.1");
    expect(await response.json()).toMatchObject({
      deviceToken: "lumii_dev_example",
      eventCursor: "cursor",
    });
  });

  it("rejects malformed input and exposes retry timing on throttling", async () => {
    const invalid = await pairDevice(
      new NextRequest("https://lumii.example/api/device/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode: "short" }),
      }),
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("INVALID_REQUEST");

    service.pairDevice.mockRejectedValue(
      new service.PairingRateLimitedError(45),
    );
    const limited = await pairDevice(
      new NextRequest("https://lumii.example/api/device/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode: "12345678" }),
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("45");
  });
});

describe("authenticated device routes", () => {
  it("requires a bearer token and returns the public status projection", async () => {
    const missing = await getStatus(
      new NextRequest("https://lumii.example/api/device/status"),
    );
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");

    service.authenticateDeviceToken.mockResolvedValue(device);
    service.getDeviceStatus.mockResolvedValue({
      apiVersion: "1",
      rank: "GOLD",
      events: [],
      nextCursor: "next",
      hasMore: false,
    });
    const response = await getStatus(
      new NextRequest(
        "https://lumii.example/api/device/status?cursor=current",
        { headers: { Authorization: "Bearer lumii_dev_example" } },
      ),
    );
    expect(response.status).toBe(200);
    expect(service.getDeviceStatus).toHaveBeenCalledWith(device, "current");
    expect(await response.json()).toMatchObject({ rank: "GOLD" });
  });

  it("rejects revoked credentials and invalid cursors", async () => {
    service.authenticateDeviceToken.mockResolvedValue(null);
    const revoked = await getConfig(
      new NextRequest("https://lumii.example/api/device/config", {
        headers: { Authorization: "Bearer lumii_dev_revoked" },
      }),
    );
    expect(revoked.status).toBe(401);
    expect(revoked.headers.get("www-authenticate")).toContain("invalid_token");

    service.authenticateDeviceToken.mockResolvedValue(device);
    service.getDeviceStatus.mockRejectedValue(new InvalidEventCursorError());
    const invalidCursor = await getStatus(
      new NextRequest(
        "https://lumii.example/api/device/status?cursor=tampered",
        { headers: { Authorization: "Bearer lumii_dev_example" } },
      ),
    );
    expect(invalidCursor.status).toBe(400);
    expect((await invalidCursor.json()).error.code).toBe("INVALID_CURSOR");
  });

  it("returns device configuration without exposing its token", async () => {
    service.authenticateDeviceToken.mockResolvedValue(device);
    service.getDeviceConfig.mockResolvedValue({
      apiVersion: "1",
      deviceId: device.id,
      brightness: 20,
      volume: 40,
      moodNudgeEnabled: false,
      pollIntervalSec: 8,
    });
    const response = await getConfig(
      new NextRequest("https://lumii.example/api/device/config", {
        headers: { Authorization: "Bearer lumii_dev_example" },
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).not.toHaveProperty("deviceToken");
    expect(body.pollIntervalSec).toBe(8);
  });
});

describe("device unpair route", () => {
  it("requires the application origin and signed-in owner", async () => {
    const wrongOrigin = await unpairDevice(
      new Request("http://localhost:3000/api/device/unpair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify({ deviceId: device.id }),
      }),
    );
    expect(wrongOrigin.status).toBe(403);

    auth.getOrCreateDbUser.mockResolvedValue(null);
    const signedOut = await unpairDevice(
      new Request("http://localhost:3000/api/device/unpair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ deviceId: device.id }),
      }),
    );
    expect(signedOut.status).toBe(401);
  });

  it("revokes an owned device and is safe to repeat", async () => {
    auth.getOrCreateDbUser.mockResolvedValue({ id: "user_123" });
    service.unpairDevice.mockResolvedValue("revoked");

    const response = await unpairDevice(
      new Request("http://localhost:3000/api/device/unpair", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: JSON.stringify({ deviceId: device.id }),
      }),
    );

    expect(response.status).toBe(200);
    expect(service.unpairDevice).toHaveBeenCalledWith("user_123", device.id);
    expect(await response.json()).toEqual({ success: true });
  });
});
