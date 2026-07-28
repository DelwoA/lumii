import { describe, expect, it } from "vitest";

import { deviceError, parseBearerToken, readSmallJson } from "./http";

describe("IoT HTTP boundary", () => {
  it("accepts one bearer token and rejects other schemes", () => {
    expect(
      parseBearerToken(
        new Request("https://example.test", {
          headers: { Authorization: "Bearer lumii_dev_token" },
        }),
      ),
    ).toBe("lumii_dev_token");
    expect(
      parseBearerToken(
        new Request("https://example.test", {
          headers: { Authorization: "Basic abc" },
        }),
      ),
    ).toBeNull();
  });

  it("requires JSON and enforces the request-size limit", async () => {
    await expect(
      readSmallJson(
        new Request("https://example.test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"pairingCode":"12345678"}',
        }),
      ),
    ).resolves.toEqual({ pairingCode: "12345678" });

    await expect(
      readSmallJson(
        new Request("https://example.test", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "{}",
        }),
      ),
    ).rejects.toThrow(TypeError);
  });

  it("adds private no-store headers to errors", async () => {
    const response = deviceError(401, "UNAUTHORIZED", "No");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
    await expect(response.json()).resolves.toEqual({
      apiVersion: "1",
      error: { code: "UNAUTHORIZED", message: "No" },
    });
  });
});
