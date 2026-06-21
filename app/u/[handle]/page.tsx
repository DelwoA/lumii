import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown } from "lucide-react";
import { getPublicProfileByHandle } from "@/lib/public-profile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LumenSpark } from "@/components/lumen-spark";
import { TrophyIcon } from "@/components/trophy-icon";

export const dynamic = "force-dynamic";

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getPublicProfileByHandle(handle);
  if (!profile) return { title: "Profile not found · LUMII" };
  return {
    title: `${profile.displayName} · LUMII`,
    description: profile.bio ?? `${profile.displayName}'s study achievements on LUMII.`,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await getPublicProfileByHandle(handle);
  if (!profile) notFound();

  return (
    <div className="bg-background flex min-h-svh flex-col items-center px-4 py-16">
      <div className="w-full max-w-xl space-y-6">
        <Card className="p-6 text-center">
          <div className="bg-primary/15 text-primary mx-auto flex size-16 items-center justify-center rounded-full">
            <LumenSpark className="size-8" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {profile.displayName}
          </h1>
          <p className="text-muted-foreground text-sm">@{profile.handle}</p>
          {profile.bio ? <p className="mt-3 text-sm">{profile.bio}</p> : null}

          <div className="mt-4 flex items-center justify-center gap-2">
            {profile.rank ? (
              <Badge className="gap-1">
                <Crown className="size-3.5" />
                {titleCase(profile.rank)}
              </Badge>
            ) : null}
            {profile.totalXp !== null ? (
              <Badge variant="secondary" className="tabular-nums">
                {profile.totalXp.toLocaleString()} XP
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            On LUMII since {profile.memberSince}
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="font-medium">
            Trophies{" "}
            <span className="text-muted-foreground font-normal">
              ({profile.trophies.length})
            </span>
          </h2>
          {profile.trophies.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">
              No trophies unlocked yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {profile.trophies.map((t) => (
                <div key={t.code} className="flex items-start gap-3">
                  <div className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                    <TrophyIcon name={t.icon} className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {t.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          <Link href="/" className="hover:text-foreground inline-flex items-center gap-1">
            <LumenSpark className="size-3.5" />
            Powered by LUMII
          </Link>
        </p>
      </div>
    </div>
  );
}
