import type { TimetableDisplayStatus } from "./types";

export const PLAN_COMPLETION_THRESHOLD = 0.8;

export function deriveTimetableStatus(input: {
  storedStatus: "PLANNED" | "COMPLETED" | "MISSED" | "CANCELLED";
  plannedEndMs: number;
  nowMs: number;
  targetDurationSec: number;
  actualDurationSec: number;
  hasActiveAttempt: boolean;
}): TimetableDisplayStatus {
  if (input.storedStatus === "CANCELLED") return "CANCELLED";
  if (
    input.storedStatus === "COMPLETED" ||
    input.actualDurationSec >=
      PLAN_COMPLETION_THRESHOLD * input.targetDurationSec
  ) {
    return "COMPLETED";
  }
  if (input.hasActiveAttempt) return "ACTIVE";
  if (input.actualDurationSec > 0) return "PARTIAL";
  if (input.plannedEndMs < input.nowMs) return "MISSED";
  return "PLANNED";
}
