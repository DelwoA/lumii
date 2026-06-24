// =============================================================================
// FILE: components/materials/material-ai-section.tsx
// WHAT THIS FILE DOES:
//   The Summary / Quiz / Chat tabs shown on a material's detail page. It owns the
//   tab switching and the Summary tab itself (generate, show, regenerate). The
//   Quiz tab uses <QuizRunner> and the Chat tab uses <MaterialChat>. It also
//   enqueues any celebration returned when a summary earns points.
// =============================================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/markdown";
import { generateSummary } from "@/app/(app)/materials/ai";
import { QuizRunner } from "@/components/materials/quiz-runner";
import { MaterialChat } from "@/components/materials/material-chat";
import { useCelebrationStore } from "@/lib/stores/celebration-store";

export function MaterialAISection({
  materialId,
  materialTitle,
  summaryMarkdown,
}: {
  materialId: string;
  materialTitle: string;
  summaryMarkdown: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const celebrate = useCelebrationStore((s) => s.celebrate);

  async function onGenerateSummary() {
    setBusy(true);
    const res = await generateSummary(materialId);
    setBusy(false);
    if (res.ok) {
      toast.success(
        res.xpAwarded ? `Summary ready · +${res.xpAwarded} XP` : "Summary ready",
      );
      router.refresh();
      celebrate(res.celebration);
    } else {
      toast.error(res.error ?? "Could not generate the summary");
    }
  }

  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList>
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="quiz">Quiz</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="mt-4">
        {busy ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : summaryMarkdown ? (
          <div className="space-y-4">
            <Markdown>{summaryMarkdown}</Markdown>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onGenerateSummary}
              disabled={busy}
            >
              <RefreshCw className="size-4" />
              Regenerate
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Sparkles className="text-primary size-8" />
            <p className="text-muted-foreground max-w-sm text-sm">
              Generate a clear, structured revision summary of this material.
            </p>
            <Button onClick={onGenerateSummary} disabled={busy} className="gap-2">
              <Sparkles className="size-4" />
              Generate summary
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="quiz" className="mt-4">
        <QuizRunner materialId={materialId} materialTitle={materialTitle} />
      </TabsContent>

      <TabsContent value="chat" className="mt-4">
        <MaterialChat materialId={materialId} />
      </TabsContent>
    </Tabs>
  );
}
