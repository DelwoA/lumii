"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDurationShort } from "@/lib/format";
import type {
  ProgressFilters,
  SessionHistoryEntry,
} from "@/lib/progress/types";

function hrefFor(
  filters: ProgressFilters,
  changes: { page?: number; session?: string | null },
) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (changes.page ?? filters.page) {
    params.set("page", String(changes.page ?? filters.page));
  }
  const session =
    changes.session === undefined ? filters.sessionId : changes.session;
  if (session) params.set("session", session);
  return `/progress?${params.toString()}`;
}

function statusLabel(entry: SessionHistoryEntry) {
  if (entry.scoreStatus === "TOO_SHORT") return "Not scored · under 10 min";
  if (entry.scoreStatus === "NO_TARGET") return "Not scored · no target";
  if (entry.autoClosed) return "Auto-closed";
  return "Completed";
}

export function SessionHistory({
  entries,
  selected,
  filters,
  page,
  total,
  totalPages,
}: {
  entries: SessionHistoryEntry[];
  selected: SessionHistoryEntry | null;
  filters: ProgressFilters;
  page: number;
  total: number;
  totalPages: number;
}) {
  const router = useRouter();

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 border-b p-5">
          <div>
            <h2 className="font-semibold">Session history</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {total} {total === 1 ? "record" : "records"} in this range
            </p>
          </div>
        </div>
        {entries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CalendarDays
              className="text-muted-foreground mx-auto size-8"
              aria-hidden="true"
            />
            <p className="mt-3 font-medium">No sessions in this range</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Change the date filter or start a focused session.
            </p>
          </div>
        ) : (
          <div className="divide-border divide-y">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={hrefFor(filters, { session: entry.id })}
                className="hover:bg-secondary/35 focus-visible:ring-ring grid gap-3 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_120px_110px] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.title}</p>
                  <p className="text-muted-foreground mt-1 flex flex-wrap gap-x-2 text-xs">
                    <span>
                      {new Date(entry.startedAtISO).toLocaleDateString()}
                    </span>
                    {entry.subjectName ? (
                      <span>{entry.subjectName}</span>
                    ) : null}
                    {entry.topicName ? <span>{entry.topicName}</span> : null}
                  </p>
                </div>
                <span className="text-muted-foreground flex items-center gap-1.5 text-sm tabular-nums">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {formatDurationShort(entry.durationSec)}
                </span>
                <div className="sm:text-right">
                  {entry.qualityScore == null ? (
                    <span className="text-muted-foreground text-xs">
                      {statusLabel(entry)}
                    </span>
                  ) : (
                    <span className="text-primary text-lg font-semibold tabular-nums">
                      {entry.qualityScore}
                      <span className="text-muted-foreground text-xs font-normal">
                        /100
                      </span>
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t p-4">
            <p className="text-muted-foreground text-xs">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                render={
                  page > 1 ? (
                    <Link
                      href={hrefFor(filters, { page: page - 1, session: null })}
                    />
                  ) : undefined
                }
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                render={
                  page < totalPages ? (
                    <Link
                      href={hrefFor(filters, { page: page + 1, session: null })}
                    />
                  ) : undefined
                }
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) router.replace(hrefFor(filters, { session: null }));
        }}
      >
        {selected ? (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{selected.title}</DialogTitle>
              <DialogDescription>
                {new Date(selected.startedAtISO).toLocaleString()} ·{" "}
                {formatDurationShort(selected.durationSec)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {selected.subjectName ? (
                  <Badge variant="secondary">{selected.subjectName}</Badge>
                ) : null}
                {selected.topicName ? (
                  <Badge variant="outline">{selected.topicName}</Badge>
                ) : null}
                <Badge variant="outline">{statusLabel(selected)}</Badge>
              </div>
              {selected.qualityScore != null ? (
                <div className="bg-secondary/60 rounded-2xl p-5">
                  <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Session quality · v{selected.qualityVersion}
                  </p>
                  <p className="mt-1 text-4xl font-semibold tabular-nums">
                    {selected.qualityScore}
                    <span className="text-muted-foreground text-base">
                      /100
                    </span>
                  </p>
                  {selected.qualityBreakdown ? (
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Duration</dt>
                        <dd>
                          {selected.qualityBreakdown.durationAdherence}/50
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Goal</dt>
                        <dd>{selected.qualityBreakdown.goalCompletion}/20</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Finish</dt>
                        <dd>{selected.qualityBreakdown.intentionalStop}/10</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Activity</dt>
                        <dd>{selected.qualityBreakdown.learningActivity}/20</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-muted-foreground mt-3 text-sm">
                      This score uses the legacy v1 formula.
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-muted rounded-xl p-4 text-sm">
                  {selected.scoreStatus === "NO_TARGET"
                    ? "Not scored—no target was set for this legacy session."
                    : "Not scored—the session was shorter than the 10-minute scoring minimum."}
                </div>
              )}
              {selected.goal ? (
                <div>
                  <h3 className="text-sm font-medium">Goal</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {selected.goal}
                  </p>
                </div>
              ) : null}
              {selected.reflection ? (
                <div>
                  <h3 className="text-sm font-medium">Private reflection</h3>
                  <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                    {selected.reflection}
                  </p>
                </div>
              ) : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
