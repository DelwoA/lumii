import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { TopicCreateDialog } from "@/components/subjects/topic-create-dialog";

export const dynamic = "force-dynamic";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireDbUser();

  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id, archivedAt: null },
    include: {
      topics: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } },
      _count: { select: { materials: true } },
    },
  });
  if (!subject) notFound();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="size-4 rounded-full"
            style={{ backgroundColor: subject.color ?? "var(--muted-foreground)" }}
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {subject.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {subject.topics.length} topics · {subject._count.materials}{" "}
              materials
            </p>
          </div>
        </div>
        <TopicCreateDialog subjectId={subject.id} />
      </div>

      {subject.topics.length === 0 ? (
        <Card className="text-muted-foreground p-8 text-center text-sm">
          No topics yet. Add one to start organising this subject.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subject.topics.map((topic) => (
            <Card key={topic.id} className="p-4">
              <span className="font-medium">{topic.name}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
