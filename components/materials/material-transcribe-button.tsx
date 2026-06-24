// =============================================================================
// FILE: components/materials/material-transcribe-button.tsx
// WHAT THIS FILE DOES:
//   The button on an audio material that starts (or retries) turning the audio
//   into text. It calls the transcribe server action and refreshes so the new
//   transcript and Ready status appear.
// =============================================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Captions, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transcribeAudioAction } from "@/app/(app)/materials/actions";

/**
 * Triggers (or retries) transcription of an audio material from the material
 * page. The happy path runs transcription right after upload; this covers an
 * interrupted attempt or a previous failure.
 */
export function MaterialTranscribeButton({
  materialId,
  status,
}: {
  materialId: string;
  status: "PENDING_TRANSCRIPTION" | "TRANSCRIBING" | "FAILED";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isRetry = status === "FAILED";

  async function onTranscribe() {
    setBusy(true);
    const res = await transcribeAudioAction(materialId);
    setBusy(false);
    if (res.ok) {
      toast.success("Audio transcribed");
      router.refresh();
    } else {
      toast.error(res.error ?? "Could not transcribe the audio");
    }
  }

  return (
    <Button size="sm" className="gap-2" onClick={onTranscribe} disabled={busy}>
      {isRetry ? (
        <RefreshCw className="size-4" />
      ) : (
        <Captions className="size-4" />
      )}
      {busy ? "Transcribing…" : isRetry ? "Retry transcription" : "Transcribe now"}
    </Button>
  );
}
