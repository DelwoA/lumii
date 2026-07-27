"use server";

import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { getProgressExportSessions } from "@/lib/progress/service";
import type { ProgressFilters } from "@/lib/progress/types";

const filterSchema = z.object({
  range: z.enum(["30d", "90d", "all", "custom"]),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.number().int().positive(),
  sessionId: z.string().optional(),
});

export async function getProgressExportAction(filters: ProgressFilters) {
  const user = await requireDbUser();
  const parsed = filterSchema.parse(filters);
  const sessions = await getProgressExportSessions(
    user.id,
    parsed,
    user.timezone || "UTC",
  );
  return {
    displayName: user.displayName || "LUMII student",
    timezone: user.timezone || "UTC",
    generatedAtISO: new Date().toISOString(),
    sessions,
  };
}
