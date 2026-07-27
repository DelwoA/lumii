"use client";

import { useState } from "react";
import { Play, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSessionStore } from "@/lib/stores/session-store";
import { getSessionSetupOptionsAction } from "@/app/(app)/sessions/actions";
import type { SessionSetupOption } from "@/lib/sessions/types";

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm";

export function StartSessionButton() {
  const { active, hydrated, starting, start } = useSessionStore();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SessionSetupOption[]>([]);
  const [loadedOptions, setLoadedOptions] = useState(false);
  const [title, setTitle] = useState("Focused study");
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");

  if (!hydrated || active) return null;

  async function showSetup() {
    setOpen(true);
    if (!loadedOptions) {
      try {
        setOptions(await getSessionSetupOptionsAction());
        setLoadedOptions(true);
      } catch {
        toast.error("Could not load subjects. You can still start a session.");
      }
    }
  }

  async function onStart() {
    const res = await start({
      title: title.trim(),
      goal: goal.trim() || null,
      targetDurationSec: minutes * 60,
      subjectId: subjectId || null,
      topicId: topicId || null,
    });
    if (res.ok) {
      setOpen(false);
      toast.success("Session started");
    } else {
      toast.error(res.error ?? "Could not start the session");
    }
  }

  const topics =
    options.find((subject) => subject.id === subjectId)?.topics ?? [];

  return (
    <>
      <Button
        size="sm"
        className="gap-1.5"
        onClick={showSetup}
        disabled={starting}
      >
        <Play className="size-3.5" aria-hidden="true" />
        Start session
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="bg-primary/10 mb-1 grid size-10 place-items-center rounded-full">
              <Sprout className="text-primary size-5" aria-hidden="true" />
            </div>
            <DialogTitle>Set your study intention</DialogTitle>
            <DialogDescription>
              A target makes the session measurable and gives you a quality
              score you can revisit later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="session-title">Session title</Label>
              <Input
                id="session-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session-subject">Subject (optional)</Label>
                <select
                  id="session-subject"
                  className={fieldClass}
                  value={subjectId}
                  onChange={(event) => {
                    setSubjectId(event.target.value);
                    setTopicId("");
                  }}
                >
                  <option value="">No subject</option>
                  {options.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-topic">Topic (optional)</Label>
                <select
                  id="session-topic"
                  className={fieldClass}
                  value={topicId}
                  disabled={!subjectId}
                  onChange={(event) => setTopicId(event.target.value)}
                >
                  <option value="">No topic</option>
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-goal">Goal (optional)</Label>
              <Textarea
                id="session-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="What would make this session feel complete?"
                maxLength={500}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="session-minutes">Target duration</Label>
                <span className="text-muted-foreground text-xs">
                  10 minutes–4 hours
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="session-minutes"
                  type="number"
                  min={10}
                  max={240}
                  step={5}
                  value={minutes}
                  onChange={(event) =>
                    setMinutes(
                      Math.max(10, Math.min(240, Number(event.target.value))),
                    )
                  }
                />
                <span className="text-muted-foreground text-sm">minutes</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onStart}
              disabled={
                starting || !title.trim() || minutes < 10 || minutes > 240
              }
              className="gap-2"
            >
              <Play className="size-4" aria-hidden="true" />
              {starting ? "Starting…" : "Begin session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
