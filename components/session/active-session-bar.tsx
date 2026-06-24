"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LumenSpark } from "@/components/lumen-spark";
import { useSessionStore } from "@/lib/stores/session-store";
import { useCelebrationStore } from "@/lib/stores/celebration-store";
import { HEARTBEAT_INTERVAL_SEC } from "@/lib/sessions/timing";
import { formatClock, formatDurationShort } from "@/lib/format";

/**
 * The persistent active-session bar. Mounted once in the app shell: it hydrates
 * the session store on first render, then (while a session runs) ticks a live
 * timer every second and sends a heartbeat on cadence. Stopping opens a short
 * reflection dialog before finalizing.
 */
export function ActiveSessionBar() {
  const { active, hydrated, stopping, refresh, beat, stop } = useSessionStore();
  const celebrate = useCelebrationStore((s) => s.celebrate);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [goalDone, setGoalDone] = useState(false);
  const [reflection, setReflection] = useState("");

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const hb = setInterval(() => void beat(), HEARTBEAT_INTERVAL_SEC * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(hb);
    };
  }, [active, beat]);

  if (!active) return null;

  const elapsedSec = Math.max(0, Math.floor((now - active.startedAtMs) / 1000));
  const target = active.targetDurationSec ?? null;
  const targetPct = target ? Math.min(100, (elapsedSec / target) * 100) : null;

  async function onConfirmStop() {
    const res = await stop({
      goalCompleted: goalDone,
      reflection: reflection.trim() || undefined,
    });
    setOpen(false);
    setReflection("");
    setGoalDone(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not stop the session");
      return;
    }
    if (res.scored) {
      const xp = res.xpAwarded ? ` · +${res.xpAwarded} XP` : "";
      toast.success(`Session saved. Quality ${res.qualityScore}/100${xp}`);
    } else {
      toast.success("Session saved (too short to score)");
    }
    celebrate(res.celebration);
  }

  return (
    <>
      <div className="bg-primary/10 border-primary/30 relative flex items-center gap-3 border-b px-4 py-2">
        {targetPct !== null ? (
          <div
            className="bg-primary/25 absolute inset-y-0 left-0"
            style={{ width: `${targetPct}%` }}
            aria-hidden="true"
          />
        ) : null}
        <LumenSpark className="size-4 shrink-0 motion-safe:animate-pulse" />
        <div className="relative min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            Studying: {active.title}
          </p>
          {active.goal ? (
            <p className="text-muted-foreground truncate text-xs">
              {active.goal}
            </p>
          ) : null}
        </div>
        <span className="relative font-mono text-sm tabular-nums">
          {formatClock(elapsedSec)}
          {target ? (
            <span className="text-muted-foreground">
              {" "}
              / {formatDurationShort(target)}
            </span>
          ) : null}
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="relative gap-1.5"
          onClick={() => setOpen(true)}
        >
          <Square className="size-3.5" />
          Stop
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this session?</DialogTitle>
            <DialogDescription>
              You studied for {formatDurationShort(elapsedSec)}. Add a quick
              reflection if you like.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="goal-done"
                checked={goalDone}
                onCheckedChange={(v) => setGoalDone(v === true)}
              />
              <Label htmlFor="goal-done" className="text-sm font-normal">
                I accomplished what I set out to do
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reflection" className="text-sm">
                Reflection (optional)
              </Label>
              <Textarea
                id="reflection"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="What did you cover? What's next?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep studying
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmStop}
              disabled={stopping}
            >
              {stopping ? "Saving…" : "End session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
