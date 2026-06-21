import "server-only";
import { generateText } from "ai";
import { withModelFallback } from "@/lib/ai/provider";
import type { ChatMessage } from "@/lib/ai/chat-types";

const MAX_HISTORY = 10;

type Part =
  | { type: "text"; text: string }
  | { type: "file"; data: string; mediaType: string; filename: string };
type ModelMessage = { role: "user" | "assistant"; content: string | Part[] };

function systemPrompt(title: string, hasContext: boolean): string {
  return [
    `You are LUMII, a supportive study tutor helping a student understand the material titled "${title}".`,
    `Teach with guiding questions and clear, step-by-step explanations. If the student asks for a direct answer to an assignment or homework, give hints and nudge them to reason it out rather than just handing over the answer.`,
    `Be concise, encouraging, and clear. Format with Markdown.`,
    hasContext
      ? `Use the provided material as your primary source. If something is not covered by it, say so and answer carefully with general knowledge, using hedging language ("likely", "generally").`
      : `The material text was not available; rely on the conversation and general knowledge, and say briefly when you are unsure.`,
  ].join("\n\n");
}

/**
 * Generate one tutor reply. Context preference (cheapest first): a text
 * summary/note is inlined into the system prompt; only when no text exists is
 * the PDF attached (more expensive) as a leading turn.
 */
export async function chatReply(opts: {
  title: string;
  context: string | null;
  fileBytes?: Uint8Array | null;
  mimeType?: string | null;
  history: ChatMessage[];
}): Promise<{ text: string; modelId: string }> {
  const hasText = Boolean(opts.context);
  const system =
    systemPrompt(opts.title, hasText || Boolean(opts.fileBytes)) +
    (opts.context ? `\n\nMATERIAL:\n${opts.context}` : "");

  const messages: ModelMessage[] = [];
  if (!hasText && opts.fileBytes && opts.mimeType) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: "Here is the study material to use as your primary source." },
        {
          type: "file",
          data: Buffer.from(opts.fileBytes).toString("base64"),
          mediaType: opts.mimeType,
          filename: "material.pdf",
        },
      ],
    });
    messages.push({
      role: "assistant",
      content: "Got it — I've reviewed the material. What would you like help with?",
    });
  }
  for (const m of opts.history.slice(-MAX_HISTORY)) {
    messages.push({ role: m.role, content: m.content });
  }

  const { result, modelId } = await withModelFallback((model) =>
    generateText({ model, system, messages, temperature: 0.5 }),
  );
  return { text: result.text.trim(), modelId };
}
