import "server-only";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { requireServerEnv } from "@/lib/env";

/**
 * Single, isolated OpenRouter provider for all AI features. Swapping to a
 * different gateway (e.g. Vercel AI Gateway) later is a change in this one file.
 *
 * Models come from env so the AI evaluation can tune them without code changes:
 *  - OPENROUTER_MODEL          primary (open/free first, e.g. Gemma 3 multimodal)
 *  - OPENROUTER_FALLBACK_MODEL paid, reliable fallback (e.g. a Gemini Flash)
 */
type OpenRouterProvider = ReturnType<typeof createOpenRouter>;
type ChatModel = ReturnType<OpenRouterProvider["chat"]>;

let provider: OpenRouterProvider | null = null;
function openrouter(): OpenRouterProvider {
  if (provider) return provider;
  const { OPENROUTER_API_KEY } = requireServerEnv("OPENROUTER_API_KEY");
  provider = createOpenRouter({ apiKey: OPENROUTER_API_KEY });
  return provider;
}

export const PRIMARY_MODEL_ID =
  process.env.OPENROUTER_MODEL || "google/gemma-3-27b-it";
export const FALLBACK_MODEL_ID =
  process.env.OPENROUTER_FALLBACK_MODEL || "google/gemini-2.5-flash";

export function primaryModel(): ChatModel {
  return openrouter().chat(PRIMARY_MODEL_ID);
}
export function fallbackModel(): ChatModel {
  return openrouter().chat(FALLBACK_MODEL_ID);
}

/**
 * Run an AI call against the primary model, falling back to the paid model if
 * the primary errors or is rate-limited. Returns the model id that produced the
 * result so callers can record it (never trust the requested model alone).
 */
export async function withModelFallback<T>(
  run: (model: ChatModel) => Promise<T>,
): Promise<{ result: T; modelId: string }> {
  try {
    return { result: await run(primaryModel()), modelId: PRIMARY_MODEL_ID };
  } catch {
    return { result: await run(fallbackModel()), modelId: FALLBACK_MODEL_ID };
  }
}

// --- Multimodal message content ---------------------------------------------

type TextPart = { type: "text"; text: string };
type FilePart = { type: "file"; data: Uint8Array; mediaType: string };
export type MaterialContent = (TextPart | FilePart)[];

/**
 * Build a user message's content from a material: a PDF is attached as a file
 * part (OpenRouter's universal PDF support handles it); a typed note is inlined
 * as text. Never include PII or mood data here.
 */
export function materialUserContent(
  instruction: string,
  material: {
    noteText?: string | null;
    fileBytes?: Uint8Array | null;
    mimeType?: string | null;
  },
): MaterialContent {
  const parts: MaterialContent = [{ type: "text", text: instruction }];
  if (material.fileBytes && material.mimeType) {
    parts.push({
      type: "file",
      data: material.fileBytes,
      mediaType: material.mimeType,
    });
  } else if (material.noteText) {
    parts.push({ type: "text", text: `\n\n--- MATERIAL ---\n${material.noteText}` });
  }
  return parts;
}
