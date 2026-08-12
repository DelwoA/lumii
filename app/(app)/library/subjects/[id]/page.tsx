import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Plus } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TopicCreateDialog } from "@/components/subjects/topic-create-dialog";
import { DeleteMenu } from "@/components/subjects/delete-menu";

export default async function LibrarySubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireDbUser();
  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id, archivedAt: null },
    include: {
      topics: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        include: {
          materials: {
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            select: { id: true, title: true, type: true, status: true },
          },
        },
      },
      materials: {
        where: { userId: user.id, topicId: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, type: true, status: true },
      },
      _count: { select: { materials: true } },
    },
  });
  if (!subject) notFound();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <nav aria-label="Breadcrumb">
        <Link
          href="/library?view=subjects"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Study Library / Subjects & Topics
        </Link>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="size-4 shrink-0 rounded-full"
            style={{
              backgroundColor: subject.color ?? "var(--muted-foreground)",
            }}
          />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold tracking-tight">
              {subject.name}
            </h1>
            <p className="text-muted-foreground text-sm">
              {subject.topics.length} topics · {subject._count.materials}{" "}
              materials
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            nativeButton={false}
            size="sm"
            render={
              <Link
                href={`/library/new?source=subject&subject=${subject.id}`}
              />
            }
            className="gap-2"
          >
            <Plus className="size-4" /> Add Material
          </Button>
          <TopicCreateDialog subjectId={subject.id} />
          <DeleteMenu
            kind="subject"
            id={subject.id}
            name={subject.name}
            redirectTo="/library?view=subjects"
          />
        </div>
      </header>

      <div className="space-y-4">
        {subject.topics.map((topic) => (
          <Card key={topic.id} className="overflow-hidden p-0">
            <div className="bg-secondary/35 flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <h2 className="font-medium">{topic.name}</h2>
                <p className="text-muted-foreground text-xs">
                  {topic.materials.length}{" "}
                  {topic.materials.length === 1 ? "material" : "materials"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={`/library/new?source=topic&subject=${subject.id}&topic=${topic.id}`}
                    />
                  }
                  className="gap-2"
                >
                  <Plus className="size-4" /> Add Material
                </Button>
                <DeleteMenu kind="topic" id={topic.id} name={topic.name} />
              </div>
            </div>
            {topic.materials.length ? (
              <ul className="divide-y">
                {topic.materials.map((material) => (
                  <li key={material.id}>
                    <Link
                      href={`/library/materials/${material.id}`}
                      className="hover:bg-muted/50 flex min-h-12 items-center gap-3 px-4 py-3 text-sm transition-colors"
                    >
                      <FileText className="text-muted-foreground size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {material.title}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {material.type.toLowerCase()}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground p-4 text-sm">
                No materials in this topic yet.
              </p>
            )}
          </Card>
        ))}

        {subject.materials.length ? (
          <Card className="overflow-hidden border-dashed p-0">
            <div className="border-b p-4">
              <h2 className="font-medium">Uncategorized</h2>
              <p className="text-muted-foreground text-xs">
                Materials attached to this subject but missing a topic.
              </p>
            </div>
            <ul className="divide-y">
              {subject.materials.map((material) => (
                <li key={material.id}>
                  <Link
                    href={`/library/materials/${material.id}?setup=concepts`}
                    className="hover:bg-muted/50 flex min-h-12 items-center gap-3 px-4 py-3 text-sm"
                  >
                    <FileText className="text-muted-foreground size-4" />
                    <span className="min-w-0 flex-1 truncate">
                      {material.title}
                    </span>
                    <span className="text-primary font-medium">
                      Analyze material →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {!subject.topics.length ? (
          <Card className="border-dashed p-8 text-center">
            <p className="font-medium">Add the first topic</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Topics keep materials and mastery evidence focused.
            </p>
            <div className="mt-4">
              <TopicCreateDialog subjectId={subject.id} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
