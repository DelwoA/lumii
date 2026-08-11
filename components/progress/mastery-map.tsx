"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MasteryOverview, MasterySummary } from "@/lib/mastery/types";

function masteryLabel(component: MasterySummary) {
  if (component.evidenceCount < 3) return "Not enough practice";
  const value = component.masteryProbability ?? 0;
  if (value < 0.5) return "Needs practice";
  if (value < 0.8) return "Developing";
  return "Strong";
}

function cellClass(component: MasterySummary) {
  if (component.evidenceCount < 3) return "bg-muted/65 hover:bg-muted";
  const value = component.masteryProbability ?? 0;
  if (value < 0.5) return "bg-[#ead9ce] hover:bg-[#e2cabc]";
  if (value < 0.8) return "bg-[#cbdcc8] hover:bg-[#bfd3bb]";
  return "bg-[#7e9d82] text-[#15271c] hover:bg-[#709176]";
}

function Trend({ points }: { points: MasteryOverview["trends"] }) {
  if (points.length < 2) {
    return (
      <div className="bg-muted/45 text-muted-foreground flex h-32 items-center justify-center rounded-xl border border-dashed text-sm">
        Complete another quiz to see a trend.
      </div>
    );
  }
  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 296 + 2;
      const y = 98 - point.masteryProbability * 92;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div className="bg-muted/25 rounded-xl border p-3">
      <svg
        viewBox="0 0 300 100"
        role="img"
        aria-label="Mastery estimate over time"
        className="h-32 w-full overflow-visible"
      >
        <line
          x1="0"
          y1="98"
          x2="300"
          y2="98"
          stroke="currentColor"
          opacity="0.12"
        />
        <line
          x1="0"
          y1="52"
          x2="300"
          y2="52"
          stroke="currentColor"
          opacity="0.08"
        />
        <polyline
          points={coordinates}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => {
          const x = (index / (points.length - 1)) * 296 + 2;
          const y = 98 - point.masteryProbability * 92;
          return (
            <circle
              key={`${point.createdAt}-${index}`}
              cx={x}
              cy={y}
              r="4"
              fill="var(--card)"
              stroke="var(--primary)"
              strokeWidth="3"
            />
          );
        })}
      </svg>
    </div>
  );
}

export function MasteryMap({ overview }: { overview: MasteryOverview }) {
  const [selectedId, setSelectedId] = useState(
    overview.recommendation?.componentId ?? overview.components[0]?.componentId,
  );
  const selected =
    overview.components.find(
      (component) => component.componentId === selectedId,
    ) ?? overview.components[0];
  const grouped = useMemo(() => {
    const subjects = new Map<
      string,
      { name: string; topics: Map<string, MasterySummary[]> }
    >();
    for (const component of overview.components) {
      const subject = subjects.get(component.subjectId) ?? {
        name: component.subjectName,
        topics: new Map<string, MasterySummary[]>(),
      };
      const topic = subject.topics.get(component.topicName) ?? [];
      topic.push(component);
      subject.topics.set(component.topicName, topic);
      subjects.set(component.subjectId, subject);
    }
    return [...subjects.values()];
  }, [overview.components]);

  if (!overview.components.length) {
    return (
      <Card className="flex flex-col items-center gap-3 border-dashed p-10 text-center">
        <Sprout className="text-primary size-8" />
        <h2 className="font-medium">Your mastery map is ready to grow</h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Open a material, assign it to a topic, and confirm its concept map.
          Your first concept-aligned quiz will create the first estimates.
        </p>
        <Button render={<Link href="/materials" />}>Open materials</Button>
      </Card>
    );
  }

  const selectedTrend = selected
    ? overview.trends.filter(
        (point) => point.componentId === selected.componentId,
      )
    : [];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
      <Card className="overflow-hidden p-0">
        <div className="border-b p-5">
          <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
            All practice history
          </p>
          <h2 className="mt-1 text-lg font-semibold">Your learning map</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Each plot is one confirmed concept. Colour, status, percentage, and
            answer count carry the same meaning.
          </p>
        </div>
        <div className="space-y-7 p-5">
          {grouped.map((subject) => (
            <section key={subject.name} aria-label={subject.name}>
              <h3 className="text-sm font-semibold">{subject.name}</h3>
              <div className="mt-3 space-y-4">
                {[...subject.topics.entries()].map(([topic, components]) => (
                  <div key={topic}>
                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                      {topic}
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {components.map((component) => {
                        const active =
                          component.componentId === selected?.componentId;
                        return (
                          <button
                            key={component.componentId}
                            type="button"
                            onClick={() => setSelectedId(component.componentId)}
                            aria-pressed={active}
                            className={cn(
                              "min-h-28 rounded-xl border p-3 text-left transition-[background-color,box-shadow,transform] focus-visible:ring-3 focus-visible:outline-none",
                              cellClass(component),
                              active && "ring-primary/50 shadow-sm ring-2",
                            )}
                          >
                            <span className="line-clamp-2 text-sm font-semibold">
                              {component.componentName}
                            </span>
                            <span className="mt-3 block font-mono text-xl font-semibold tabular-nums">
                              {component.masteryProbability == null
                                ? "—"
                                : `${Math.round(component.masteryProbability * 100)}%`}
                            </span>
                            <span className="mt-1 block text-[11px] leading-tight opacity-75">
                              {masteryLabel(component)} ·{" "}
                              {component.evidenceCount} answers
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Card>

      {selected ? (
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs">
                  {selected.subjectName} / {selected.topicName}
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {selected.componentName}
                </h2>
              </div>
              <Badge variant="secondary">{masteryLabel(selected)}</Badge>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="bg-muted/45 rounded-xl p-3">
                <p className="text-muted-foreground text-xs">
                  Mastery estimate
                </p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {selected.masteryProbability == null
                    ? "—"
                    : `${Math.round(selected.masteryProbability * 100)}%`}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  BKT posterior
                </p>
              </div>
              <div className="bg-muted/45 rounded-xl p-3">
                <p className="text-muted-foreground text-xs">Next answer</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                  {selected.nextCorrectProbability == null
                    ? "—"
                    : `${Math.round(selected.nextCorrectProbability * 100)}%`}
                </p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Chance on a medium question
                </p>
              </div>
            </div>
            <p className="text-muted-foreground mt-3 text-xs">
              Based on {selected.evidenceCount} answers ·{" "}
              {selected.modelVersion ?? "Waiting for practice"}
            </p>
            {selected.materialId ? (
              <Button
                className="mt-4 w-full justify-between"
                render={
                  <Link
                    href={`/materials/${selected.materialId}?tab=quiz&focus=${selected.componentId}`}
                  />
                }
              >
                Practice this concept
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
          </Card>
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <BookOpenCheck className="text-primary size-4" />
              <h3 className="font-medium">Mastery trend</h3>
            </div>
            <Trend points={selectedTrend} />
          </Card>
        </aside>
      ) : null}
    </div>
  );
}
