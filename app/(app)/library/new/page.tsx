import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MaterialCreator } from "@/components/library/material-creator";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewMaterialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireDbUser();
  const query = await searchParams;
  const subjects = await prisma.subject.findMany({
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
  });
  const requestedSubject = first(query.subject);
  const selectedSubject = subjects.find(
    (subject) => subject.id === requestedSubject,
  );
  const requestedTopic = first(query.topic);
  const selectedTopic = selectedSubject?.topics.find(
    (topic) => topic.id === requestedTopic,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <nav aria-label="Breadcrumb">
        <Link
          href="/library"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" /> Study Library
        </Link>
      </nav>
      <MaterialCreator
        initialSubjects={subjects}
        initialSubjectId={selectedSubject?.id ?? null}
        initialTopicId={selectedTopic?.id ?? null}
        source={first(query.source) ?? null}
      />
    </div>
  );
}
