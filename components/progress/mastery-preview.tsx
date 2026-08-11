import Link from "next/link";
import { ArrowRight, BrainCircuit, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MasteryOverview } from "@/lib/mastery/types";

export function MasteryPreview({ overview }: { overview: MasteryOverview }) {
  const recommendation = overview.recommendation;
  if (!overview.components.length) {
    return (
      <Card className="border-dashed p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Sprout className="text-primary mt-0.5 size-5 shrink-0" />
            <div>
              <h2 className="font-medium">Start your mastery map</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Confirm concepts on a material, then complete a practice quiz.
              </p>
            </div>
          </div>
          <Button variant="outline" render={<Link href="/materials" />}>
            Open materials
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card className="bg-primary text-primary-foreground relative overflow-hidden p-5">
        <BrainCircuit className="absolute -right-4 -bottom-5 size-28 opacity-10" />
        <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-75">
          Study this next
        </p>
        <h2 className="mt-2 text-xl font-semibold">
          {recommendation?.componentName ?? "Keep practising"}
        </h2>
        <p className="mt-1 text-sm opacity-80">
          {recommendation
            ? `${recommendation.subjectName} / ${recommendation.topicName}`
            : "Your next concept will appear here."}
        </p>
        {recommendation?.materialId ? (
          <Button
            className="mt-5 gap-2"
            variant="secondary"
            render={
              <Link
                href={`/materials/${recommendation.materialId}?tab=quiz&focus=${recommendation.componentId}`}
              />
            }
          >
            Practice now
            <ArrowRight className="size-4" />
          </Button>
        ) : null}
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
              Mastery map
            </p>
            <h2 className="mt-1 font-medium">
              {overview.components.length} tracked concepts
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/progress/mastery" />}
          >
            Open map
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {overview.components.slice(0, 10).map((component) => {
            const probability = component.masteryProbability;
            const background =
              component.evidenceCount < 5
                ? "bg-muted"
                : (probability ?? 0) < 0.5
                  ? "bg-[#ead9ce]"
                  : (probability ?? 0) < 0.8
                    ? "bg-[#cbdcc8]"
                    : "bg-[#7e9d82]";
            return (
              <div
                key={component.componentId}
                title={`${component.componentName}: ${probability == null ? "No estimate" : `${Math.round(probability * 100)}%`}`}
                className={`${background} flex aspect-square items-center justify-center rounded-lg border p-2 text-center`}
              >
                <span className="line-clamp-2 text-[11px] leading-tight font-medium">
                  {component.componentName}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
