// =============================================================================
// FILE: components/markdown.tsx
// WHAT THIS FILE DOES:
//   Turns Markdown text (the format the AI summaries and tutor replies come in)
//   into nicely styled on-screen content: headings, bold, bullet lists, and so
//   on. It uses react-markdown and applies readable typography styling.
// =============================================================================
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Renders trusted AI markdown (summaries, chat) with readable typography. */
export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
