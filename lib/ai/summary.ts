import "server-only";
import { generateText } from "ai";
import { withModelFallback, materialUserContent } from "@/lib/ai/provider";

export const SUMMARY_GENERATION_VERSION = "1";

const SUMMARY_SYSTEM = `You are an expert study assistant. Produce a clear, well-structured revision summary of the provided material in GitHub-flavored Markdown.

Use this structure:
- A short one-paragraph overview.
- "## Key concepts": concise bullet points.
- "## Key terms": a bullet list where each item is "term: short definition".
- "## Likely exam focus": a few bullets on what to prioritise.

Rules:
- Be faithful to the material; never invent facts not present in it.
- If the material is unclear or incomplete, say so briefly and use hedging language ("appears to", "likely").
- Keep it tight and skimmable. Do NOT add a preamble like "Here is the summary".
- Do not use em dashes; prefer colons, commas, or shorter sentences.`;

/**
 * Generate a revision-summary in Markdown from a material (multimodal PDF or
 * typed note). Returns the markdown and the model that actually produced it.
 */
export async function generateSummaryMarkdown(material: {
  title: string;
  noteText?: string | null;
  fileBytes?: Uint8Array | null;
  mimeType?: string | null;
}): Promise<{ markdown: string; modelId: string }> {
  const instruction = `Summarise the study material titled "${material.title}".`;
  const { result, modelId } = await withModelFallback((model) =>
    generateText({
      model,
      system: SUMMARY_SYSTEM,
      messages: [
        { role: "user", content: materialUserContent(instruction, material) },
      ],
      temperature: 0.4,
    }),
  );
  return { markdown: result.text.trim(), modelId };
}
