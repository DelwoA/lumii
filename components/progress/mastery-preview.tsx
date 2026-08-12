"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BrainCircuit, ListFilter, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  MasteryOverview,
  MasterySummary,
  RecommendationReason,
} from "@/lib/mastery/types";

const reasonCopy: Record<RecommendationReason, string> = {
  BUILD_COVERAGE: "Build a reliable baseline with a few more answers.",
  STRENGTHEN_WEAKNESS:
    "This is your weakest concept that is ready for another pass.",
  SPACED_REVIEW: "It has waited longest since your last practice.",
};

function conceptStatus(component: MasterySummary) {
  if (component.evidenceCount === 0) return "Not practised yet";
  if (component.evidenceCount < 3) {
    return `${component.evidenceCount} of 3 baseline answers`;
  }
  if (component.masteryProbability == null) {
    return `${component.evidenceCount} answers`;
  }
  return `${Math.round(component.masteryProbability * 100)}% mastery`;
}

export function MasteryPreview({ overview }: { overview: MasteryOverview }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const recommendation = overview.recommendation;
  const groups = useMemo(() => {
    const grouped = new Map<string, MasterySummary[]>();
    for (const component of overview.components) {
      if (!component.materialId) continue;
      const label = `${component.subjectName} / ${component.topicName}`;
      grouped.set(label, [...(grouped.get(label) ?? []), component]);
    }
    return [...grouped.entries()];
  }, [overview.components]);

  function practise(component: MasterySummary) {
    if (!component.materialId) return;
    setPickerOpen(false);
    router.push(
      `/library/materials/${component.materialId}?tab=quiz&focus=${component.componentId}`,
    );
  }

  if (!overview.components.length) {
    return (
      <Card className="border-dashed p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Sprout
              aria-hidden="true"
              className="text-primary mt-0.5 size-5 shrink-0"
            />
            <div>
              <h2 className="font-medium">Start your mastery map</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Confirm concepts on a material, then complete a practice quiz.
              </p>
            </div>
          </div>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/library/new" />}
          >
            Add Material
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="bg-primary text-primary-foreground relative overflow-hidden p-5">
          <BrainCircuit
            aria-hidden="true"
            className="absolute -right-4 -bottom-5 size-28 opacity-10"
          />
          <p className="text-xs font-semibold tracking-[0.14em] uppercase opacity-75">
            Study this next
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {recommendation?.componentName ?? "Choose what to practise"}
          </h2>
          <p className="mt-1 text-sm opacity-80">
            {recommendation
              ? `${recommendation.subjectName} / ${recommendation.topicName}`
              : "Pick any practice-ready concept from your library."}
          </p>
          {overview.recommendationReason ? (
            <p className="mt-3 max-w-md text-sm leading-relaxed opacity-90">
              {reasonCopy[overview.recommendationReason]}
            </p>
          ) : null}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {recommendation?.materialId ? (
              <Button
                nativeButton={false}
                className="gap-2 sm:flex-1"
                variant="secondary"
                render={
                  <Link
                    href={`/library/materials/${recommendation.materialId}?tab=quiz&focus=${recommendation.componentId}`}
                  />
                }
              >
                Practice Now
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
            {groups.length ? (
              <Button
                type="button"
                variant="outline"
                className="border-primary-foreground/35 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground bg-transparent sm:flex-1"
                onClick={() => setPickerOpen(true)}
              >
                <ListFilter aria-hidden="true" className="size-4" />
                Choose Another Concept
              </Button>
            ) : null}
          </div>
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
              nativeButton={false}
              variant="ghost"
              size="sm"
              render={<Link href="/progress/mastery" />}
            >
              Open Map
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

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="gap-0 overflow-hidden overscroll-contain p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-5 pt-5 pr-12 pb-4">
            <DialogTitle>Choose a Concept to Practise</DialogTitle>
            <DialogDescription>
              Search your confirmed concepts, grouped by subject and topic.
            </DialogDescription>
          </DialogHeader>
          <Command className="rounded-none! p-0">
            <CommandInput
              placeholder="Search concepts…"
              aria-label="Search concepts"
            />
            <CommandList className="max-h-[min(24rem,60dvh)] p-2">
              <CommandEmpty>No matching concepts found.</CommandEmpty>
              {groups.map(([label, components]) => (
                <CommandGroup key={label} heading={label}>
                  {components.map((component) => (
                    <CommandItem
                      key={component.componentId}
                      value={`${component.componentName} ${component.subjectName} ${component.topicName}`}
                      className="items-start py-2.5"
                      onSelect={() => practise(component)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {component.componentName}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-xs">
                          {conceptStatus(component)}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
