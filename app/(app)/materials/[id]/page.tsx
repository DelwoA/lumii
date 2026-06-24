import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignDownload } from "@/lib/storage/r2";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MaterialDeleteButton } from "@/components/materials/material-delete-button";
import { MaterialAISection } from "@/components/materials/material-ai-section";
import { MaterialTranscribeButton } from "@/components/materials/material-transcribe-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  PENDING_UPLOAD: "Pending",
  PENDING_TRANSCRIPTION: "Transcribing",
  TRANSCRIBING: "Transcribing",
  READY: "Ready",
  FAILED: "Failed",
} as const;

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireDbUser();

  const material = await prisma.material.findFirst({
    where: { id, userId: user.id },
    include: {
      subject: { select: { name: true } },
      summaries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });
  if (!material) notFound();

  const latestSummary = material.summaries[0]?.content ?? null;

  // Audio shows its player while it is queued/transcribing too.
  const fileViewable =
    material.status === "READY" ||
    material.status === "TRANSCRIBING" ||
    material.status === "PENDING_TRANSCRIPTION";
  const fileUrl =
    material.type !== "NOTE" && material.r2Key && fileViewable
      ? await presignDownload(material.r2Key, 600)
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Link
        href="/materials"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to materials
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {material.title}
            </h1>
            <Badge variant="outline">
              {material.type === "PDF"
                ? "PDF"
                : material.type === "IMAGE"
                  ? "Image"
                  : material.type === "AUDIO"
                    ? "Audio"
                    : "Note"}
            </Badge>
            <Badge
              variant={
                material.status === "READY"
                  ? "default"
                  : material.status === "FAILED"
                    ? "destructive"
                    : "secondary"
              }
            >
              {STATUS_LABEL[material.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {material.subject?.name ?? "No subject"}
          </p>
        </div>
        <MaterialDeleteButton materialId={material.id} />
      </div>

      {material.type === "NOTE" ? (
        <Card className="p-5">
          <pre className="font-sans text-sm whitespace-pre-wrap">
            {material.noteText}
          </pre>
        </Card>
      ) : (
        <>
          {fileUrl ? (
            <Card className="overflow-hidden p-0">
              {material.type === "IMAGE" ? (
                <div className="bg-muted/30 flex max-h-[70vh] justify-center overflow-auto p-4">
                  {/* Plain img (not next/image): the source is a short-lived presigned URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fileUrl}
                    alt={material.title}
                    className="h-auto max-w-full object-contain"
                  />
                </div>
              ) : material.type === "AUDIO" ? (
                <div className="p-4">
                  <audio controls src={fileUrl} className="w-full" />
                </div>
              ) : (
                <iframe
                  src={fileUrl}
                  title={material.title}
                  className="h-[70vh] w-full"
                />
              )}
              <div className="border-t p-3">
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium underline underline-offset-4"
                >
                  Open in a new tab
                </a>
              </div>
            </Card>
          ) : material.type === "AUDIO" ? null : (
            <Card className="text-muted-foreground p-8 text-center text-sm">
              {material.status === "FAILED"
                ? "This file failed to upload or validate."
                : "This file is still processing."}
            </Card>
          )}

          {material.type === "AUDIO" &&
          (material.status === "PENDING_TRANSCRIPTION" ||
            material.status === "TRANSCRIBING" ||
            material.status === "FAILED") ? (
            <Card className="flex flex-col items-start gap-3 p-5">
              <p className="text-muted-foreground text-sm">
                {material.status === "FAILED"
                  ? "We could not transcribe this audio. You can try again."
                  : "Transcribing this audio. This usually takes under a minute."}
              </p>
              <MaterialTranscribeButton
                materialId={material.id}
                status={material.status}
              />
            </Card>
          ) : null}
        </>
      )}

      {material.status === "READY" ? (
        <Card className="p-5">
          <MaterialAISection
            materialId={material.id}
            materialTitle={material.title}
            summaryMarkdown={latestSummary}
          />
        </Card>
      ) : null}
    </div>
  );
}
