/**
 * Verify the multimodal PDF path (base64 file part) on both configured models.
 *   set -a; source .env.local; set +a; pnpm tsx scripts/ai-pdf-smoke.ts
 */
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

const SAMPLE_PDF =
  "https://raw.githubusercontent.com/py-pdf/sample-files/main/001-trivial/minimal-document.pdf";

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const res = await fetch(SAMPLE_PDF);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const b64 = Buffer.from(bytes).toString("base64");
  const head = Buffer.from(bytes.slice(0, 8)).toString("latin1");
  console.log(`bytes=${bytes.length} head=${JSON.stringify(head)}`);

  const openrouter = createOpenRouter({ apiKey });
  const ids = [
    process.env.OPENROUTER_MODEL ?? "google/gemma-3-27b-it",
    process.env.OPENROUTER_FALLBACK_MODEL ?? "google/gemini-2.5-flash",
  ];

  for (const id of ids) {
    const t0 = Date.now();
    try {
      const { text } = await generateText({
        model: openrouter.chat(id),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What text is in this PDF? One line." },
              { type: "file", data: b64, mediaType: "application/pdf", filename: "doc.pdf" },
            ],
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      console.log(`\n${id} (${Date.now() - t0}ms): ${text.trim().slice(0, 140)}`);
    } catch (err) {
      console.log(`\n${id} ERR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
