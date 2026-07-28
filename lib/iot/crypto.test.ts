import { describe, expect, it } from "vitest";

import {
  digestCredential,
  generateDeviceToken,
  generatePairingCode,
  signValue,
  signatureMatches,
} from "./crypto";

const PEPPER = "test-pepper-with-more-than-thirty-two-characters";

describe("IoT credential helpers", () => {
  it("generates fixed-width numeric pairing codes", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(generatePairingCode()).toMatch(/^\d{8}$/);
    }
  });

  it("generates high-entropy device tokens with a recognizable prefix", () => {
    const first = generateDeviceToken();
    const second = generateDeviceToken();
    expect(first).toMatch(/^lumii_dev_[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("domain-separates stored credential digests", () => {
    const value = "12345678";
    expect(digestCredential("pairing-code", value, PEPPER)).not.toBe(
      digestCredential("device-token", value, PEPPER),
    );
    expect(digestCredential("pairing-code", value, PEPPER)).toBe(
      digestCredential("pairing-code", value, PEPPER),
    );
  });

  it("checks cursor signatures without accepting changes", () => {
    const value = "signed-payload";
    const signature = signValue(value, PEPPER);
    expect(signatureMatches(value, signature, PEPPER)).toBe(true);
    expect(signatureMatches(`${value}x`, signature, PEPPER)).toBe(false);
    expect(signatureMatches(value, `${signature}x`, PEPPER)).toBe(false);
  });
});
