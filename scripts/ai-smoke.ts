/**
 * Standalone smoke test for the OpenRouter connection + models.
 * Run with the env loaded, e.g.:
 *   set -a; source .env.local; set +a; pnpm tsx scripts/ai-smoke.ts
 *
 * It does NOT import lib/ai/provider.ts (that uses "server-only").
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

async function tryModel(apiKey: string, modelId: string) {
  const openrouter = createOpenRouter({ apiKey });
  const started = Date.now();
  try {
    const { text } = await generateText({
      model: openrouter.chat(modelId),
      prompt: "Reply with exactly: LUMII AI OK",
    });
    return { modelId, ok: true, ms: Date.now() - started, text: text.trim().slice(0, 80) };
  } catch (err) {
    return {
      modelId,
      ok: false,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const primary = process.env.OPENROUTER_MODEL || "google/gemma-3-27b-it:free";
  const fallback = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemini-2.5-flash";

  console.log("Testing primary:", primary);
  console.log(JSON.stringify(await tryModel(apiKey, primary), null, 2));
  console.log("Testing fallback:", fallback);
  console.log(JSON.stringify(await tryModel(apiKey, fallback), null, 2));
}

main().catch((e) => {
  console.error("AI smoke failed:", e);
  process.exit(1);
});
