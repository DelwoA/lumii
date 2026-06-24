// =============================================================================
// FILE: app/(app)/settings/page.tsx   ->   web address: /settings
// WHAT THIS FILE DOES:
//   The Settings page. It loads the student's current profile and public-profile
//   settings on the server, then hands them to the interactive SettingsClient
//   component (the forms for profile, public showcase, and privacy controls).
// =============================================================================
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireDbUser();
  const publicProfile = await prisma.publicProfile.findUnique({
    where: { userId: user.id },
  });

  return (
    <SettingsClient
      profile={{ displayName: user.displayName, timezone: user.timezone }}
      publicProfile={
        publicProfile
          ? {
              isPublic: publicProfile.isPublic,
              handle: publicProfile.handle,
              displayName: publicProfile.displayName,
              bio: publicProfile.bio,
              showRank: publicProfile.showRank,
              showXp: publicProfile.showXp,
            }
          : null
      }
      defaultDisplayName={user.displayName ?? ""}
    />
  );
}
