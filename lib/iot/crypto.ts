import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

function hmac(namespace: string, value: string, pepper: string): Buffer {
  return createHmac("sha256", pepper)
    .update(`${namespace}\0${value}`, "utf8")
    .digest();
}

export function digestCredential(
  namespace: "pairing-code" | "device-token" | "pairing-source",
  value: string,
  pepper: string,
): string {
  return hmac(namespace, value, pepper).toString("base64url");
}

export function generatePairingCode(): string {
  return randomInt(0, 100_000_000).toString().padStart(8, "0");
}

export function generateDeviceToken(): string {
  return `lumii_dev_${randomBytes(32).toString("base64url")}`;
}

export function signValue(value: string, pepper: string): string {
  return hmac("event-cursor", value, pepper).toString("base64url");
}

export function signatureMatches(
  value: string,
  signature: string,
  pepper: string,
): boolean {
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  const expected = hmac("event-cursor", value, pepper);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
