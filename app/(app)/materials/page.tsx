import Link from "next/link";
import { FileText, PenLine } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LumenSpark } from "@/components/lumen-spark";
import { MaterialUploadDialog } from "@/components/materials/material-upload-dialog";
import { NoteCreateDialog } from "@/components/materials/note-create-dialog";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  PENDING_UPLOAD: "Pending",
  READY: "Ready",
  FAILED: "Failed",
} as const;

export default async function MaterialsPage() {
  const user = await requireDbUser();

  const [materials, subjects] = await Promise.all([
    prisma.material.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { subject: { select: { name: true } } },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Materials</h1>
          <p className="text-muted-foreground text-sm">
            Upload PDFs or paste notes, then summarise, quiz, and chat.
          </p>
        </div>
        <div className="flex gap-2">
          <NoteCreateDialog subjects={subjects} />
          <MaterialUploadDialog subjects={subjects} />
        </div>
      </div>

      {materials.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <LumenSpark className="size-10 opacity-80" />
          <p className="font-medium">No materials yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Upload a lecture PDF or add a typed note to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => (
            <Link key={m.id} href={`/materials/${m.id}`} className="group">
              <Card className="hover:border-primary/50 flex h-full flex-col gap-3 p-4 transition group-hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-muted text-muted-foreground rounded-md p-2">
                    {m.type === "PDF" ? (
                      <FileText className="size-4" />
                    ) : (
                      <PenLine className="size-4" />
                    )}
                  </div>
                  <Badge
                    variant={
                      m.status === "READY"
                        ? "default"
                        : m.status === "FAILED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {STATUS_LABEL[m.status]}
                  </Badge>
                </div>
                <div>
                  <p className="line-clamp-2 font-medium">{m.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {m.subject?.name ?? "No subject"}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
