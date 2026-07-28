"use server";

// =============================================================================
// FILE: app/(app)/settings/actions.ts
// WHAT THIS FILE DOES:
//   Server actions for the Settings page: saving the profile (display name and
//   timezone) and saving the public showcase settings (handle, on/off, and what
//   to show). It validates input with Zod, checks the signed-in user, and keeps
//   handles unique. (Deleting mood data lives in the mood actions file.)
// =============================================================================

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HANDLE_RE, normalizeHandle } from "@/lib/public-profile";
import { isValidTimeZone } from "@/lib/timetable/dates";
import { updateDeviceInputSchema } from "@/lib/iot/schemas";
import {
  createDevicePairingCode,
  DeviceApiDisabledError,
  DeviceLimitError,
  PairingCodeLimitError,
  updateDevice,
} from "@/lib/iot/service";

export type SettingsResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  displayName: z.string().trim().max(60).nullable(),
  timezone: z.string().trim().min(1),
});

export async function updateProfile(input: {
  displayName: string | null;
  timezone: string;
}): Promise<SettingsResult> {
  const user = await requireDbUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  if (!isValidTimeZone(parsed.data.timezone)) {
    return { ok: false, error: "That timezone is not recognised" };
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName: parsed.data.displayName || null,
      timezone: parsed.data.timezone,
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

const publicSchema = z.object({
  isPublic: z.boolean(),
  handle: z
    .string()
    .trim()
    .transform(normalizeHandle)
    .refine((h) => HANDLE_RE.test(h), {
      message: "Handle must be 3-30 characters: a-z, 0-9, or hyphen",
    }),
  displayName: z.string().trim().min(1, "Display name is required").max(60),
  bio: z.string().trim().max(300).nullable(),
  showRank: z.boolean(),
  showXp: z.boolean(),
});

export async function savePublicProfile(input: {
  isPublic: boolean;
  handle: string;
  displayName: string;
  bio: string | null;
  showRank: boolean;
  showXp: boolean;
}): Promise<SettingsResult> {
  const user = await requireDbUser();
  const parsed = publicSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  try {
    await prisma.publicProfile.upsert({
      where: { userId: user.id },
      update: {
        isPublic: data.isPublic,
        handle: data.handle,
        displayName: data.displayName,
        bio: data.bio,
        showRank: data.showRank,
        showXp: data.showXp,
      },
      create: {
        userId: user.id,
        isPublic: data.isPublic,
        handle: data.handle,
        displayName: data.displayName,
        bio: data.bio,
        showRank: data.showRank,
        showXp: data.showXp,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, error: "That handle is already taken" };
    }
    return { ok: false, error: "Could not save your public profile" };
  }

  revalidatePath("/settings");
  revalidatePath(`/u/${data.handle}`);
  return { ok: true };
}

export type PairingCodeResult =
  | { ok: true; pairingCode: string; expiresAtISO: string }
  | { ok: false; error: string };

export async function generateDevicePairingCode(): Promise<PairingCodeResult> {
  const user = await requireDbUser();
  try {
    const result = await createDevicePairingCode(user.id);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof DeviceApiDisabledError) {
      return { ok: false, error: "Device pairing is not enabled yet" };
    }
    if (error instanceof DeviceLimitError) {
      return { ok: false, error: "Unpair a device before adding another one" };
    }
    if (error instanceof PairingCodeLimitError) {
      return {
        ok: false,
        error: "Too many pairing codes were requested. Try again in one hour.",
      };
    }
    return { ok: false, error: "Could not generate a pairing code" };
  }
}

export async function saveDeviceSettings(input: {
  deviceId: string;
  name: string;
  brightness: number;
  volume: number;
  moodNudgeEnabled: boolean;
}): Promise<SettingsResult> {
  const user = await requireDbUser();
  const parsed = updateDeviceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid device settings",
    };
  }
  const updated = await updateDevice(user.id, parsed.data);
  if (!updated) return { ok: false, error: "Device not found" };
  revalidatePath("/settings");
  return { ok: true };
}
