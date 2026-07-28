import {
  IOT_PAIRING_CODES_PER_HOUR,
  IOT_PAIRING_CODE_TTL_MS,
} from "@/lib/iot/constants";

export const IOT_PAIRING_CODE_RETENTION_MS = 60 * 60 * 1000;

/**
 * Pairing rows are indexed by expiresAt. Codes expire ten minutes after they
 * are created, so removing rows whose expiry is more than fifty minutes old
 * gives each row a total lifetime of one hour.
 */
export function pairingCodeCleanupCutoff(now: Date): Date {
  return new Date(
    now.getTime() - (IOT_PAIRING_CODE_RETENTION_MS - IOT_PAIRING_CODE_TTL_MS),
  );
}

export async function cleanupExpiredPairingCodes(
  now: Date,
  deleteBefore: (cutoff: Date) => Promise<{ count: number }>,
): Promise<number> {
  const result = await deleteBefore(pairingCodeCleanupCutoff(now));
  return result.count;
}

export function pairingCodeGenerationLimitReached(
  recentCount: number,
): boolean {
  return recentCount >= IOT_PAIRING_CODES_PER_HOUR;
}
