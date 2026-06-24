// =============================================================================
// FILE: components/celebration/celebration-overlay.tsx
// WHAT THIS FILE DOES:
//   The reward pop-up. Mounted once in the app shell, it watches the celebration
//   queue (lib/stores/celebration-store.ts) and, when a trophy is unlocked or
//   the student ranks up, shows a dialog with a confetti burst (canvas-confetti).
//   It respects "reduced motion" settings and shows one celebration at a time.
// =============================================================================
"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Crown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrophyIcon } from "@/components/trophy-icon";
import { useCelebrationStore } from "@/lib/stores/celebration-store";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** A short, celebratory confetti burst (skipped under reduced motion). */
function fireConfetti(): void {
  if (prefersReducedMotion()) return;
  const base = { startVelocity: 45, gravity: 0.9, ticks: 200, zIndex: 100 };
  confetti({ ...base, particleCount: 90, spread: 75, origin: { x: 0.5, y: 0.35 } });
  setTimeout(
    () => confetti({ ...base, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.65 } }),
    150,
  );
  setTimeout(
    () => confetti({ ...base, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.65 } }),
    150,
  );
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * Global award celebration. Mounted once in the app shell; shows a modal with a
 * confetti burst for each queued trophy unlock or rank-up, one at a time.
 */
export function CelebrationOverlay() {
  const current = useCelebrationStore((s) => s.current);
  const dismiss = useCelebrationStore((s) => s.dismiss);

  useEffect(() => {
    if (current) fireConfetti();
  }, [current]);

  if (!current) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogContent showCloseButton={false} className="text-center sm:max-w-sm">
        <DialogTitle className="sr-only">
          {current.kind === "trophy" ? "Achievement unlocked" : "Rank up"}
        </DialogTitle>
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="bg-primary/15 text-primary flex size-16 items-center justify-center rounded-full">
            {current.kind === "trophy" ? (
              <TrophyIcon name={current.trophy.icon} className="size-8" />
            ) : (
              <Crown className="size-8" />
            )}
          </div>

          {current.kind === "trophy" ? (
            <>
              <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                Achievement unlocked
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                {current.trophy.name}
              </h2>
              <p className="text-muted-foreground text-sm">
                {current.trophy.description}
              </p>
              {current.trophy.xp > 0 ? (
                <p className="text-primary font-mono text-sm">
                  +{current.trophy.xp} XP
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-muted-foreground font-mono text-xs tracking-[0.18em] uppercase">
                Rank up
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                You reached {titleCase(current.rank)}
              </h2>
              <p className="text-muted-foreground text-sm">
                Keep it up. Your studying is paying off.
              </p>
            </>
          )}

          <Button className="mt-2 rounded-full px-6" onClick={dismiss}>
            Nice!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
