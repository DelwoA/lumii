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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionStore } from "@/lib/stores/session-store";
import { getSessionSetupOptionsAction } from "@/app/(app)/sessions/actions";
import type { SessionSetupOption } from "@/lib/sessions/types";

const NONE = "none";

export function StartSessionButton() {
  const { active, hydrated, starting, start } = useSessionStore();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SessionSetupOption[]>([]);
  const [loadedOptions, setLoadedOptions] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [title, setTitle] = useState("Focused study");
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [subjectId, setSubjectId] = useState(NONE);
  const [topicId, setTopicId] = useState(NONE);

  if (!hydrated || active) return null;

  async function showSetup() {
    setOpen(true);
    if (!loadedOptions) {
      setLoadingOptions(true);
      try {
        setOptions(await getSessionSetupOptionsAction());
        setLoadedOptions(true);
      } catch {
        toast.error("Could not load subjects. You can still start a session.");
      } finally {
        setLoadingOptions(false);
      }
    }
  }

  async function onStart() {
    const res = await start({
      title: title.trim(),
      goal: goal.trim() || null,
      targetDurationSec: minutes * 60,
      subjectId: subjectId === NONE ? null : subjectId,
      topicId: topicId === NONE ? null : topicId,
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
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {loadingOptions ? (
                <>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-full rounded-md" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="session-subject">Subject (optional)</Label>
                    <Select
                      value={subjectId}
                      items={Object.fromEntries([
                        [NONE, "No subject"],
                        ...options.map((subject) => [subject.id, subject.name]),
                      ])}
                      onValueChange={(value) => {
                        setSubjectId(value ?? NONE);
                        setTopicId(NONE);
                      }}
                    >
                      <SelectTrigger id="session-subject" className="w-full">
                        <SelectValue placeholder="No subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No subject</SelectItem>
                        {options.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-topic">Topic (optional)</Label>
                    <Select
                      value={topicId}
                      items={Object.fromEntries([
                        [NONE, "No topic"],
                        ...topics.map((topic) => [topic.id, topic.name]),
                      ])}
                      disabled={subjectId === NONE}
                      onValueChange={(value) => setTopicId(value ?? NONE)}
                    >
                      <SelectTrigger id="session-topic" className="w-full">
                        <SelectValue placeholder="No topic" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No topic</SelectItem>
                        {topics.map((topic) => (
                          <SelectItem key={topic.id} value={topic.id}>
                            {topic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
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
