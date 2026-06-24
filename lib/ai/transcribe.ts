// =============================================================================
// FILE: lib/ai/transcribe.ts
// WHAT THIS FILE DOES:
//   Turns an uploaded AUDIO recording into written text (this is called speech
//   to text, or transcription). That text then becomes the material's content,
//   so summaries, quizzes, and the tutor work on it like any other material.
//
// NOTE: this uses the PRIMARY model only, with no fallback, because the fallback
//   model cannot listen to audio. The instruction (TRANSCRIBE_SYSTEM) tells it
//   to write only what is said and to mark unclear parts as [inaudible].
//   A `signal` can cancel the call if it runs over the allowed time.
// =============================================================================
import "server-only";
import { generateText } from "ai";
import {
  primaryModel,
  PRIMARY_MODEL_ID,
  materialUserContent,
} from "@/lib/ai/provider";

const TRANSCRIBE_SYSTEM = [
  "You are a precise audio transcriber for study recordings (lectures, tutorials, and voice notes).",
  "Transcribe the spoken content into clean, readable text.",
  "Rules:",
  "- Write only what is actually said; do not summarise, add, or invent content.",
  "- Use natural sentences and paragraphs with sensible punctuation and capitalisation.",
  "- Remove filler sounds and false starts where it improves readability, without changing meaning.",
  "- If a passage is inaudible, write [inaudible] rather than guessing.",
  "- Do not add timestamps, commentary, or headings. Output only the transcript text.",
  "- Do not use em dashes.",
].join("\n");

/**
 * Transcribe an audio clip to text using the audio-capable primary model. This
 * deliberately does NOT use the text-only fallback model (it cannot read audio).
 */
export async function transcribeAudio(opts: {
  fileBytes: Uint8Array;
  mimeType: string;
  /** Aborts the model call when the caller's time budget is exhausted. */
  signal?: AbortSignal;
}): Promise<{ text: string; modelId: string }> {
  const result = await generateText({
    model: primaryModel(),
    system: TRANSCRIBE_SYSTEM,
    messages: [
      {
        role: "user",
        content: materialUserContent(
          "Transcribe this audio recording. Return only the transcript text.",
          { fileBytes: opts.fileBytes, mimeType: opts.mimeType },
        ),
      },
    ],
    temperature: 0,
    abortSignal: opts.signal,
  });
  return { text: result.text.trim(), modelId: PRIMARY_MODEL_ID };
}
