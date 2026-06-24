// =============================================================================
// FILE: app/(app)/subjects/page.tsx   ->   web address: /subjects
// WHAT THIS FILE DOES:
//   The Subjects page. It lists the student's subjects as cards (with a colour
//   dot and the topic/material counts), plus the "New subject" dialog and each
//   card's delete menu. Clicking a card opens that subject's detail page
//   (app/(app)/subjects/[id]/page.tsx).
// =============================================================================
import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { LumenSpark } from "@/components/lumen-spark";
import { SubjectCreateDialog } from "@/components/subjects/subject-create-dialog";
import { DeleteMenu } from "@/components/subjects/delete-menu";

export const dynamic = "force-dynamic";

export default async function SubjectsPage() {
  const user = await requireDbUser();
  const subjects = await prisma.subject.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { topics: true, materials: true } } },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground text-sm">
            Organise your studies into subjects and topics.
          </p>
        </div>
        <SubjectCreateDialog />
      </div>

      {subjects.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <LumenSpark className="size-10 opacity-80" />
          <p className="font-medium">No subjects yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create your first subject to start uploading materials and tracking
            study sessions.
          </p>
          <div className="mt-2">
            <SubjectCreateDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <div key={s.id} className="group relative">
              <Link href={`/subjects/${s.id}`} className="block">
                <Card className="p-4 transition group-hover:ring-primary/50 group-hover:shadow-sm">
                  <div className="flex items-center gap-2 pr-8">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: s.color ?? "var(--muted-foreground)",
                      }}
                    />
                    <span className="truncate font-medium">{s.name}</span>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {s._count.topics} topics · {s._count.materials} materials
                  </p>
                </Card>
              </Link>
              <div className="absolute top-2 right-2">
                <DeleteMenu kind="subject" id={s.id} name={s.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
