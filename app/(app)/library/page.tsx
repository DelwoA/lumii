import Link from "next/link";
import {
  BookOpen,
  FileText,
  Image as ImageIcon,
  Music,
  PenLine,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubjectCreateDialog } from "@/components/subjects/subject-create-dialog";
import { DeleteMenu } from "@/components/subjects/delete-menu";

export const dynamic = "force-dynamic";

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

function MaterialIcon({ type }: { type: "PDF" | "IMAGE" | "AUDIO" | "NOTE" }) {
  const Icon =
    type === "PDF"
      ? FileText
      : type === "IMAGE"
        ? ImageIcon
        : type === "AUDIO"
          ? Music
          : PenLine;
  return <Icon className="size-4" aria-hidden="true" />;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireDbUser();
  const query = await searchParams;
  const requestedView = first(query.view);
  const view =
    requestedView === "subjects" || requestedView === "setup"
      ? requestedView
      : "materials";
  const search = first(query.q)?.trim() ?? "";
  const subjectFilter = first(query.subject) ?? "all";
  const statusFilter = first(query.status) ?? "all";

  const [materials, subjects, setupCount] = await Promise.all([
    prisma.material.findMany({
      where: {
        userId: user.id,
        ...(search
          ? { title: { contains: search, mode: "insensitive" as const } }
          : {}),
        ...(subjectFilter !== "all" ? { subjectId: subjectFilter } : {}),
        ...(statusFilter === "ready"
          ? { status: "READY" as const }
          : statusFilter === "failed"
            ? { status: "FAILED" as const }
            : statusFilter === "processing"
              ? {
                  status: {
                    in: [
                      "PENDING_UPLOAD" as const,
                      "PENDING_TRANSCRIPTION" as const,
                      "TRANSCRIBING" as const,
                    ],
                  },
                }
              : {}),
        ...(view === "setup"
          ? {
              OR: [
                { subjectId: null },
                { topicId: null },
                {
                  status: "READY" as const,
                  knowledgeComponents: {
                    none: {
                      knowledgeComponent: { status: "CONFIRMED" as const },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        subject: { select: { name: true } },
        topic: { select: { name: true } },
        knowledgeComponents: {
          select: { knowledgeComponent: { select: { status: true } } },
        },
      },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { name: "asc" },
      include: {
        topics: {
          where: { archivedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
        _count: { select: { topics: true, materials: true } },
      },
    }),
    prisma.material.count({
      where: {
        userId: user.id,
        OR: [
          { subjectId: null },
          { topicId: null },
          {
            status: "READY",
            knowledgeComponents: {
              none: { knowledgeComponent: { status: "CONFIRMED" } },
            },
          },
        ],
      },
    }),
  ]);

  const views = [
    { value: "materials", label: "Materials", href: "/library" },
    {
      value: "subjects",
      label: "Subjects & Topics",
      href: "/library?view=subjects",
    },
    {
      value: "setup",
      label: "Needs Setup",
      href: "/library?view=setup",
      count: setupCount,
    },
  ] as const;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-5 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
            Learning content
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Study Library
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Keep material, subjects, topics, and concept setup together in one
            place.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/library/new" />}
          className="gap-2 self-start"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Material
        </Button>
      </header>

      <nav
        aria-label="Study Library views"
        className="bg-secondary/55 flex gap-1 overflow-x-auto rounded-xl p-1"
      >
        {views.map((item) => (
          <Link
            key={item.value}
            href={item.href}
            aria-current={view === item.value ? "page" : undefined}
            className={`focus-visible:ring-ring/40 flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none ${
              view === item.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
            {"count" in item && item.count > 0 ? (
              <Badge variant="secondary" className="min-w-6 justify-center">
                {item.count}
              </Badge>
            ) : null}
          </Link>
        ))}
      </nav>

      {view === "subjects" ? (
        <section className="space-y-5" aria-labelledby="subjects-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="subjects-heading" className="text-xl font-semibold">
                Subjects & Topics
              </h2>
              <p className="text-muted-foreground text-sm">
                Build the hierarchy used to organize every new material.
              </p>
            </div>
            <SubjectCreateDialog />
          </div>
          {subjects.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {subjects.map((subject) => (
                <div key={subject.id} className="group relative">
                  <Link
                    href={`/library/subjects/${subject.id}`}
                    className="block h-full"
                  >
                    <Card className="group-hover:border-primary/50 h-full p-5 transition group-hover:shadow-sm">
                      <div className="flex items-center gap-3 pr-8">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              subject.color ?? "var(--muted-foreground)",
                          }}
                        />
                        <span className="truncate font-medium">
                          {subject.name}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-3 text-xs">
                        {subject._count.topics} topics ·{" "}
                        {subject._count.materials} materials
                      </p>
                      {subject.topics.length ? (
                        <p className="text-muted-foreground mt-2 line-clamp-1 text-xs">
                          {subject.topics
                            .map((topic) => topic.name)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </Card>
                  </Link>
                  <div className="absolute top-3 right-3">
                    <DeleteMenu
                      kind="subject"
                      id={subject.id}
                      name={subject.name}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center gap-3 border-dashed p-10 text-center">
              <BookOpen className="text-primary size-8" />
              <h3 className="font-medium">Create your first subject</h3>
              <p className="text-muted-foreground max-w-md text-sm">
                Every new material needs a subject and topic. Start with the
                course you are studying now.
              </p>
              <SubjectCreateDialog />
            </Card>
          )}
        </section>
      ) : (
        <section className="space-y-5" aria-labelledby="materials-heading">
          <div>
            <h2 id="materials-heading" className="text-xl font-semibold">
              {view === "setup" ? "Needs Setup" : "Materials"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {view === "setup"
                ? "Finish organization or concept review before starting a quiz."
                : "Search, filter, and continue learning from everything you have added."}
            </p>
          </div>

          <Card className="p-4">
            <form
              method="get"
              className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_180px_auto] md:items-end"
            >
              {view === "setup" ? (
                <input type="hidden" name="view" value="setup" />
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="library-search">Search</Label>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="library-search"
                    name="q"
                    defaultValue={search}
                    placeholder="Search titles"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="library-subject">Subject</Label>
                <Select
                  name="subject"
                  defaultValue={subjectFilter}
                  items={Object.fromEntries([
                    ["all", "All subjects"],
                    ...subjects.map((subject) => [subject.id, subject.name]),
                  ])}
                >
                  <SelectTrigger id="library-subject" className="w-full">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="library-status">State</Label>
                <Select
                  name="status"
                  defaultValue={statusFilter}
                  items={{
                    all: "Any state",
                    ready: "Ready",
                    processing: "Processing",
                    failed: "Needs attention",
                  }}
                >
                  <SelectTrigger id="library-status" className="w-full">
                    <SelectValue placeholder="Any state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any state</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Needs attention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" variant="outline" className="gap-2">
                <SlidersHorizontal className="size-4" /> Apply
              </Button>
            </form>
          </Card>

          {materials.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {materials.map((material) => {
                const proposed = material.knowledgeComponents.some(
                  (link) => link.knowledgeComponent.status === "PROPOSED",
                );
                const confirmed = material.knowledgeComponents.some(
                  (link) => link.knowledgeComponent.status === "CONFIRMED",
                );
                const setupAction =
                  !material.subjectId || !material.topicId
                    ? "Choose Subject & Topic"
                    : proposed
                      ? "Review & Confirm"
                      : !confirmed && material.status === "READY"
                        ? "Map Concepts"
                        : null;
                const href = `/library/materials/${material.id}${
                  setupAction
                    ? `?setup=${!material.subjectId || !material.topicId ? "organization" : "concepts"}`
                    : ""
                }`;
                return (
                  <Link key={material.id} href={href} className="group">
                    <Card className="group-hover:border-primary/50 flex h-full flex-col gap-4 p-5 transition group-hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <span className="bg-muted text-muted-foreground rounded-lg p-2.5">
                          <MaterialIcon type={material.type} />
                        </span>
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
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 font-medium">
                          {material.title}
                        </h3>
                        <p className="text-muted-foreground mt-1 truncate text-xs">
                          {material.subject?.name && material.topic?.name
                            ? `${material.subject.name} › ${material.topic.name}`
                            : (material.subject?.name ?? "Not organized")}
                        </p>
                      </div>
                      {setupAction ? (
                        <div className="text-primary mt-auto border-t pt-3 text-sm font-medium">
                          {setupAction} →
                        </div>
                      ) : null}
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="flex flex-col items-center gap-3 border-dashed p-12 text-center">
              <BookOpen className="text-primary size-8" />
              <h3 className="font-medium">
                {view === "setup"
                  ? "Everything is ready"
                  : "No materials found"}
              </h3>
              <p className="text-muted-foreground max-w-md text-sm">
                {view === "setup"
                  ? "Your materials are organized and their concept maps are confirmed."
                  : search || subjectFilter !== "all" || statusFilter !== "all"
                    ? "Try changing the search or filters."
                    : "Add a file or typed note and organize it for study."}
              </p>
              {view !== "setup" && !search ? (
                <Button
                  nativeButton={false}
                  render={<Link href="/library/new" />}
                >
                  Add Material
                </Button>
              ) : null}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
