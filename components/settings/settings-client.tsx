"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { updateProfile, savePublicProfile } from "@/app/(app)/settings/actions";
import { deleteMoodData } from "@/app/(app)/mood/actions";

interface ProfileInit {
  displayName: string | null;
  timezone: string;
}
interface PublicInit {
  isPublic: boolean;
  handle: string;
  displayName: string;
  bio: string | null;
  showRank: boolean;
  showXp: boolean;
}

export function SettingsClient({
  profile,
  publicProfile,
  defaultDisplayName,
}: {
  profile: ProfileInit;
  publicProfile: PublicInit | null;
  defaultDisplayName: string;
}) {
  const router = useRouter();

  // Profile
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [savingProfile, setSavingProfile] = useState(false);

  // Public profile
  const [isPublic, setIsPublic] = useState(publicProfile?.isPublic ?? false);
  const [handle, setHandle] = useState(publicProfile?.handle ?? "");
  const [pubName, setPubName] = useState(
    publicProfile?.displayName ?? defaultDisplayName,
  );
  const [bio, setBio] = useState(publicProfile?.bio ?? "");
  const [showRank, setShowRank] = useState(publicProfile?.showRank ?? true);
  const [showXp, setShowXp] = useState(publicProfile?.showXp ?? false);
  const [savingPublic, setSavingPublic] = useState(false);

  async function onSaveProfile() {
    setSavingProfile(true);
    const res = await updateProfile({
      displayName: displayName.trim() || null,
      timezone: timezone.trim(),
    });
    setSavingProfile(false);
    if (res.ok) {
      toast.success("Profile updated");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onSavePublic() {
    setSavingPublic(true);
    const res = await savePublicProfile({
      isPublic,
      handle: handle.trim(),
      displayName: pubName.trim(),
      bio: bio.trim() || null,
      showRank,
      showXp,
    });
    setSavingPublic(false);
    if (res.ok) {
      toast.success("Public profile saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onDeleteMood() {
    try {
      await deleteMoodData();
      toast.success("Mood data deleted");
    } catch {
      toast.error("Could not delete mood data");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, public showcase, and privacy.
        </p>
      </div>

      {/* Profile */}
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">Profile</h2>
          <p className="text-muted-foreground text-sm">
            Your name and timezone (used for streaks and day boundaries).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <div className="flex gap-2">
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. Asia/Colombo"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setTimezone(
                    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                  )
                }
              >
                Detect
              </Button>
            </div>
          </div>
        </div>
        <Button onClick={onSaveProfile} disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save profile"}
        </Button>
      </Card>

      {/* Public profile */}
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">Public showcase</h2>
          <p className="text-muted-foreground text-sm">
            Optionally share a public page with your rank and trophies. It never
            shows your materials, quizzes, timetable, sessions, or mood.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="is-public"
            checked={isPublic}
            onCheckedChange={(v) => setIsPublic(v === true)}
          />
          <Label htmlFor="is-public" className="font-normal">
            Make my profile public
          </Label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="handle">Handle</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">/u/</span>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                placeholder="your-handle"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pub-name">Public display name</Label>
            <Input
              id="pub-name"
              value={pubName}
              onChange={(e) => setPubName(e.target.value)}
              placeholder="Shown on your public page"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short line about you (optional)"
            rows={2}
          />
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-rank"
              checked={showRank}
              onCheckedChange={(v) => setShowRank(v === true)}
            />
            <Label htmlFor="show-rank" className="font-normal">
              Show my rank
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-xp"
              checked={showXp}
              onCheckedChange={(v) => setShowXp(v === true)}
            />
            <Label htmlFor="show-xp" className="font-normal">
              Show my total XP
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={onSavePublic} disabled={savingPublic}>
            {savingPublic ? "Saving…" : "Save public profile"}
          </Button>
          {publicProfile?.isPublic && publicProfile.handle ? (
            <Link
              href={`/u/${publicProfile.handle}`}
              className="text-primary text-sm underline-offset-4 hover:underline"
              target="_blank"
            >
              View public page
            </Link>
          ) : null}
        </div>
      </Card>

      {/* Privacy + danger zone */}
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-medium">Privacy</h2>
          <p className="text-muted-foreground text-sm">
            Mood check-ins store only a label and expire after 30 days. You can
            delete them all now.
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="outline">Delete my mood data</Button>}
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all mood data?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes every mood check-in label on your
                account. This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction onClick={onDeleteMood}>
                Delete mood data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <p className="text-muted-foreground border-t pt-4 text-sm">
          To delete your entire account, open the account menu (your avatar,
          top right) and choose to delete it. Your materials and data are
          removed automatically.
        </p>
      </Card>
    </div>
  );
}
