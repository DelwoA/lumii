import { z } from "zod";

export const pairDeviceInputSchema = z
  .object({
    pairingCode: z.string().regex(/^\d{8}$/, "Use the 8-digit pairing code"),
  })
  .strict();

export const unpairDeviceInputSchema = z
  .object({
    deviceId: z.string().min(1).max(64),
  })
  .strict();

export const updateDeviceInputSchema = z
  .object({
    deviceId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(40),
    brightness: z.number().int().min(0).max(100),
    volume: z.number().int().min(0).max(100),
    moodNudgeEnabled: z.boolean(),
  })
  .strict();

export type PairDeviceInput = z.infer<typeof pairDeviceInputSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceInputSchema>;

export interface DeviceView {
  id: string;
  name: string;
  brightness: number;
  volume: number;
  moodNudgeEnabled: boolean;
  pairedAtISO: string;
  lastSeenAtISO: string | null;
  online: boolean;
}

export type DeviceEventV1 =
  | {
      id: string;
      type: "rank_up";
      occurredAt: string;
      data: { fromRank: string; toRank: string };
    }
  | {
      id: string;
      type: "trophy_unlocked";
      occurredAt: string;
      data: { code: string };
    }
  | {
      id: string;
      type: "quiz_completed";
      occurredAt: string;
      data: {
        correctCount: number;
        questionCount: number;
        scorePercent: number;
        perfect: boolean;
      };
    }
  | {
      id: string;
      type: "adherent_day" | "perfect_day";
      occurredAt: string;
      data: { localDate: string };
    };

export interface DeviceStatusV1 {
  apiVersion: "1";
  deviceId: string;
  serverTime: string;
  rank: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
  totalXp: number;
  currentStreak: number;
  activeSession: null | {
    id: string;
    startedAt: string;
    elapsedSec: number;
  };
  rankUp: boolean;
  upcomingReminder: null | {
    id: string;
    title: string;
    plannedStart: string;
  };
  moodCheckinNeeded: boolean;
  events: DeviceEventV1[];
  nextCursor: string;
  hasMore: boolean;
}
