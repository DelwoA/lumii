"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { logMood, type MoodResult } from "@/app/(app)/mood/actions";
import type { MoodValence } from "@/lib/ai/mood";

const ACK: Record<MoodValence, string> = {
  POSITIVE: "Love that energy. Keep riding it while it lasts.",
  NEUTRAL: "Steady is good. One step at a time.",
  NEGATIVE:
    "Tough moments pass. Be kind to yourself and take it in small steps.",
};

const PLACEHOLDER =
  "e.g. Finished my calculus revision and feeling on top of it, but a little nervous about tomorrow's quiz.";

type Checked = Extract<MoodResult, { ok: true }>;

export function MoodCheckin() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Checked | null>(null);

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    const res = await logMood(value);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setText("");
    setResult(res);
  }

  if (result) {
    return (
      <Card className="p-5">
        <h2 className="font-medium">Checked in</h2>
        <p className="mt-3 text-sm font-medium">{result.heading}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          <span className="text-foreground/80 font-medium">Mood:</span>{" "}
          {result.mood}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          {ACK[result.valence]}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            onClick={() => setResult(null)}
          >
            Check in again
          </Button>
          <span className="text-muted-foreground text-xs">
            Saved to your Progress page.
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-medium">How&apos;s studying feeling?</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Describe how studying feels in your own words.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={3}
        maxLength={1000}
        className="mt-3"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-md text-xs">
          Your check-in (your words, plus an AI heading and mood) is private to
          you and kept until you delete it. See it on the Progress page.
        </p>
        <Button
          className="shrink-0"
          disabled={busy || !text.trim()}
          onClick={submit}
        >
          {busy ? "Checking in…" : "Check in"}
        </Button>
      </div>
    </Card>
  );
}
