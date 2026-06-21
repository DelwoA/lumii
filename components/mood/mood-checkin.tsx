"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import type { MoodLabel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logMoodFromText, logMoodSelf } from "@/app/(app)/mood/actions";

const CHIPS: { label: MoodLabel; text: string }[] = [
  { label: "MOTIVATED", text: "Motivated" },
  { label: "NEUTRAL", text: "Okay" },
  { label: "TIRED", text: "Tired" },
  { label: "STRESSED", text: "Stressed" },
  { label: "FRUSTRATED", text: "Frustrated" },
];

const ACK: Record<MoodLabel, string> = {
  MOTIVATED: "Love that energy. Ride the wave while it lasts.",
  NEUTRAL: "Steady is good. One step at a time.",
  TIRED: "Take it gentle. Short, focused bursts work well today.",
  STRESSED: "Breathe. Break the work into smaller pieces.",
  FRUSTRATED: "Tough moments pass. Maybe revisit a summary before pushing on.",
};

export function MoodCheckin() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState<string | null>(null);

  function acknowledge(label: MoodLabel | null) {
    setAck(label ? ACK[label] : "Thanks for checking in.");
  }

  async function submitText() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    const res = await logMoodFromText(value);
    setBusy(false);
    setText("");
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    acknowledge(res.label);
  }

  async function submitSelf(label: MoodLabel) {
    if (busy) return;
    setBusy(true);
    const res = await logMoodSelf(label);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    acknowledge(res.label);
  }

  if (ack) {
    return (
      <Card className="p-5">
        <h2 className="font-medium">Checked in</h2>
        <p className="text-muted-foreground mt-2 text-sm">{ack}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 -ml-2"
          onClick={() => setAck(null)}
        >
          Check in again
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="font-medium">How&apos;s studying feeling?</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <Button
            key={c.label}
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={busy}
            onClick={() => submitSelf(c.label)}
          >
            {c.text}
          </Button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Or describe it in your own words…"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submitText();
            }
          }}
        />
        <Button
          size="icon"
          aria-label="Submit check-in"
          disabled={busy || !text.trim()}
          onClick={submitText}
        >
          <Send className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Your words are used once to gauge your mood, then discarded. Only the
        mood label is kept (for 30 days), and it stays private.
      </p>
    </Card>
  );
}
