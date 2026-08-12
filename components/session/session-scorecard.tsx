"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Leaf } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SessionQualityBreakdown } from "@/lib/gamification/session-quality";

interface ScorecardResult {
  sessionId: string;
  durationSec: number;
  qualityScore: number | null;
  scoreStatus: "PENDING" | "SCORED" | "TOO_SHORT" | "NO_TARGET";
  qualityBreakdown: SessionQualityBreakdown | null;
  qualityVersion: string | null;
  xpAwarded?: number;
}

const dimensions = [
  ["Duration", "durationAdherence", 50],
  ["Goal follow-through", "goalCompletion", 20],
  ["Intentional finish", "intentionalStop", 10],
  ["Learning activity", "learningActivity", 20],
] as const;

export function SessionScorecard({
  result,
  open,
  onOpenChange,
}: {
  result: ScorecardResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!result) return null;
  const scored =
    result.scoreStatus === "SCORED" && result.qualityBreakdown !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="bg-primary/10 mb-1 grid size-11 place-items-center rounded-full">
            {scored ? (
              <Leaf className="text-primary size-5" aria-hidden="true" />
            ) : (
              <CheckCircle2
                className="text-primary size-5"
                aria-hidden="true"
              />
            )}
          </div>
          <DialogTitle>
            {scored ? "Your session has taken root" : "Session saved"}
          </DialogTitle>
          <DialogDescription>
            {scored
              ? "A transparent habit score based on your target, follow-through, and verified activity—not intelligence or mastery."
              : result.scoreStatus === "TOO_SHORT"
                ? "Sessions need at least 10 credited minutes to receive a quality score."
                : "This legacy session had no target, so it could not be scored."}
          </DialogDescription>
        </DialogHeader>

        {scored ? (
          <div className="grid gap-5">
            <div className="border-primary/20 bg-secondary/60 flex items-end justify-between rounded-2xl border p-5">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Session quality · v{result.qualityVersion}
                </p>
                <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
                  {result.qualityScore}
                  <span className="text-muted-foreground text-xl">/100</span>
                </p>
              </div>
              {result.xpAwarded ? (
                <span className="bg-card rounded-full px-3 py-1 text-sm font-medium shadow-sm">
                  +{result.xpAwarded} XP
                </span>
              ) : null}
            </div>
            <div className="space-y-3">
              {dimensions.map(([label, key, maximum]) => {
                const value = result.qualityBreakdown?.[key] ?? 0;
                return (
                  <div key={key}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span>{label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {value}/{maximum}
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(value / maximum) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={`/progress?session=${result.sessionId}`} />}
          >
            View in progress
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
