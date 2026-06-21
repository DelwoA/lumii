"use client";

import { Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/stores/session-store";

/**
 * Topbar quick action to start a standalone study session. Hidden while a
 * session is already running (the persistent bar shows Stop instead) and until
 * the store has hydrated, to avoid a flash of the wrong control.
 */
export function StartSessionButton() {
  const { active, hydrated, starting, start } = useSessionStore();
  if (!hydrated || active) return null;

  async function onStart() {
    const res = await start();
    if (res.ok) toast.success("Session started");
    else toast.error(res.error ?? "Could not start the session");
  }

  return (
    <Button size="sm" className="gap-1.5" onClick={onStart} disabled={starting}>
      <Play className="size-3.5" />
      {starting ? "Starting…" : "Start session"}
    </Button>
  );
}
