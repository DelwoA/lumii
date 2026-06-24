// =============================================================================
// FILE: app/(app)/subjects/[id]/page.tsx   ->   web address: /subjects/<id>
// WHAT THIS FILE DOES:
//   One subject's detail page. The [id] in the folder name is a placeholder: it
//   means this single file serves /subjects/ANY-id, and the id is read from the
//   address to load that subject. It shows the subject's topics, the "Add topic"
//   dialog, delete menus, and a "Back to subjects" link. If the id is not the
//   user's own subject, it shows the not-found page.
// =============================================================================
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { TopicCreateDialog } from "@/components/subjects/topic-create-dialog";
import { DeleteMenu } from "@/components/subjects/delete-menu";

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
      <Link
        href="/subjects"
        className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to subjects
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="size-4 shrink-0 rounded-full"
            style={{ backgroundColor: subject.color ?? "var(--muted-foreground)" }}
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {subject.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {subject.topics.length} topics · {subject._count.materials}{" "}
              materials
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TopicCreateDialog subjectId={subject.id} />
          <DeleteMenu
            kind="subject"
            id={subject.id}
            name={subject.name}
            redirectTo="/subjects"
          />
        </div>
      </div>

      {subject.topics.length === 0 ? (
        <Card className="text-muted-foreground p-8 text-center text-sm">
          No topics yet. Add one to start organising this subject.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subject.topics.map((topic) => (
            <Card
              key={topic.id}
              className="flex-row items-center justify-between gap-2 p-4"
            >
              <span className="truncate font-medium">{topic.name}</span>
              <DeleteMenu kind="topic" id={topic.id} name={topic.name} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
