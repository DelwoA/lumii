import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignDownload } from "@/lib/storage/r2";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MaterialDeleteButton } from "@/components/materials/material-delete-button";
import { MaterialAISection } from "@/components/materials/material-ai-section";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  PENDING_UPLOAD: "Pending",
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

  const fileUrl =
    material.type === "PDF" && material.r2Key && material.status === "READY"
      ? await presignDownload(material.r2Key, 600)
      : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {material.title}
            </h1>
            <Badge variant="outline">
              {material.type === "PDF" ? "PDF" : "Note"}
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
      ) : material.status === "READY" && fileUrl ? (
        <Card className="overflow-hidden p-0">
          <iframe
            src={fileUrl}
            title={material.title}
            className="h-[70vh] w-full"
          />
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
      ) : (
        <Card className="text-muted-foreground p-8 text-center text-sm">
          {material.status === "FAILED"
            ? "This file failed to upload or validate."
            : "This file is still processing."}
        </Card>
      )}

      <Card className="p-5">
        <MaterialAISection
          materialId={material.id}
          materialTitle={material.title}
          summaryMarkdown={latestSummary}
        />
      </Card>
    </div>
  );
}
