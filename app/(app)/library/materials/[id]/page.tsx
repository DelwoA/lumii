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
import { MaterialOrganization } from "@/components/library/material-organization";
import { MaterialTitle } from "@/components/materials/material-title";

const STATUS_LABEL = {
  PENDING_UPLOAD: "Uploading",
  PENDING_TRANSCRIPTION: "Transcribing",
  TRANSCRIBING: "Transcribing",
  READY: "Ready",
  FAILED: "Needs attention",
} as const;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LibraryMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const tab = first(query.tab);
  const focus = first(query.focus);
  const setup = first(query.setup);
  const user = await requireDbUser();
  const [material, subjects] = await Promise.all([
    prisma.material.findFirst({
      where: { id, userId: user.id },
      include: {
        subject: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
        knowledgeComponents: {
          include: { knowledgeComponent: true },
          orderBy: { createdAt: "asc" },
        },
        summaries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { content: true },
        },
      },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        topics: {
          where: { archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
  ]);
  if (!material) notFound();

  const fileViewable = [
    "READY",
    "TRANSCRIBING",
    "PENDING_TRANSCRIPTION",
  ].includes(material.status);
  const fileUrl =
    material.type !== "NOTE" && material.r2Key && fileViewable
      ? await presignDownload(material.r2Key, 600)
      : null;
  const concepts = material.knowledgeComponents.map((link) => {
    const evidence = link.evidence as { passages?: unknown } | null;
    return {
      id: link.knowledgeComponent.id,
      name: link.knowledgeComponent.name,
      description: link.knowledgeComponent.description,
      status: link.knowledgeComponent.status,
      evidence: Array.isArray(evidence?.passages)
        ? evidence.passages.filter(
            (passage): passage is string => typeof passage === "string",
          )
        : [],
    };
  });
  const learningWorkspace =
    material.status === "READY" ? (
      <Card className="p-5">
        <MaterialAISection
          materialId={material.id}
          materialTitle={material.title}
          summaryMarkdown={material.summaries[0]?.content ?? null}
          subjectName={material.subject?.name ?? null}
          topicName={material.topic?.name ?? null}
          concepts={concepts}
          defaultTab={tab === "quiz" || tab === "chat" ? tab : "summary"}
          initialFocusComponentId={focus}
          autoFocusConcepts={setup === "concepts"}
        />
      </Card>
    ) : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <nav aria-label="Breadcrumb">
        <Link
          href="/library"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Study Library / Materials
        </Link>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MaterialTitle
              materialId={material.id}
              initialTitle={material.title}
            />
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
            {material.subject && material.topic
              ? `${material.subject.name} › ${material.topic.name}`
              : "Not fully organized"}
          </p>
        </div>
        <MaterialDeleteButton materialId={material.id} />
      </header>

      <MaterialOrganization
        materialId={material.id}
        subjects={subjects}
        initialSubjectId={material.subjectId}
        initialTopicId={material.topicId}
        autoFocus={setup === "organization"}
      />

      {setup === "concepts" ? learningWorkspace : null}

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

      {setup !== "concepts" ? learningWorkspace : null}
    </div>
  );
}
