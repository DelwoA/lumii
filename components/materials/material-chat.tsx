"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import { chatAboutMaterial } from "@/app/(app)/materials/chat-actions";
import type { ChatMessage } from "@/lib/ai/chat-types";

export function MaterialChat({ materialId }: { materialId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function onSend() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    const res = await chatAboutMaterial(materialId, next);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[50vh] min-h-40 space-y-3 overflow-y-auto rounded-md border p-3">
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Ask the tutor anything about this material. Tip: generate a summary
            first for faster, focused answers. Chats aren&apos;t saved.
          </p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                {m.role === "assistant" ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))
        )}
        {busy ? (
          <p className="text-muted-foreground text-sm">Tutor is thinking…</p>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this material…"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <Button onClick={onSend} disabled={busy || !input.trim()} className="gap-2">
          <Send className="size-4" />
          Send
        </Button>
      </div>
    </div>
  );
}
