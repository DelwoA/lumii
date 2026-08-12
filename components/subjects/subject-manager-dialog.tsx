"use client";

import { useState, useTransition } from "react";
import {
  BookOpen,
  FolderCog,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createOrganizerSubject,
  deleteOrganizerSubject,
  renameOrganizerSubject,
} from "@/app/(app)/subjects/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ManagedSubject = {
  id: string;
  name: string;
  color?: string | null;
  topicCount: number;
  materialCount: number;
  topics: { id: string; name: string }[];
};

type Mutation =
  | { type: "create" }
  | { type: "rename"; id: string }
  | { type: "delete"; id: string }
  | null;

export function SubjectManagerDialog({
  subjects,
  selectedSubjectId,
  disabled,
  onCreated,
  onRenamed,
  onDeleted,
}: {
  subjects: ManagedSubject[];
  selectedSubjectId: string;
  disabled?: boolean;
  onCreated: (subject: ManagedSubject) => void;
  onRenamed: (subject: ManagedSubject) => void;
  onDeleted: (subjectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedSubject | null>(null);
  const [mutation, setMutation] = useState<Mutation>(null);
  const [pending, startTransition] = useTransition();

  function createSubject() {
    const name = createName.trim();
    if (!name) {
      setCreateError("Enter a subject name.");
      return;
    }
    setCreateError(null);
    setMutation({ type: "create" });
    startTransition(async () => {
      const result = await createOrganizerSubject({ name });
      if (!result.ok) {
        setCreateError(result.error);
        setMutation(null);
        return;
      }
      onCreated({
        id: result.id,
        name: result.name,
        color: null,
        topicCount: result.topicCount,
        materialCount: result.materialCount,
        topics: [],
      });
      setCreateName("");
      setMutation(null);
      setOpen(false);
      toast.success("Subject created and selected");
    });
  }

  function beginRename(subject: ManagedSubject) {
    setRenameId(subject.id);
    setRenameName(subject.name);
    setRenameError(null);
  }

  function renameSubject(subject: ManagedSubject) {
    const name = renameName.trim();
    if (!name) {
      setRenameError("Enter a subject name.");
      return;
    }
    setRenameError(null);
    setMutation({ type: "rename", id: subject.id });
    startTransition(async () => {
      const result = await renameOrganizerSubject({
        subjectId: subject.id,
        name,
      });
      if (!result.ok) {
        setRenameError(result.error);
        setMutation(null);
        return;
      }
      onRenamed({ ...subject, name: result.name });
      setRenameId(null);
      setMutation(null);
      toast.success("Subject renamed");
    });
  }

  function deleteSubject() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setMutation({ type: "delete", id: target.id });
    startTransition(async () => {
      const result = await deleteOrganizerSubject(target.id);
      if (!result.ok) {
        setMutation(null);
        toast.error(result.error);
        return;
      }
      onDeleted(target.id);
      setMutation(null);
      setDeleteTarget(null);
      toast.success(
        result.materialCount > 0
          ? `Subject deleted · ${result.materialCount} ${result.materialCount === 1 ? "material needs" : "materials need"} setup`
          : "Subject deleted",
      );
    });
  }

  const createPending = pending && mutation?.type === "create";

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={disabled}
            >
              <FolderCog className="size-4" aria-hidden="true" />
              Manage Subjects
            </Button>
          }
        />
        <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden overscroll-contain p-0 sm:h-auto sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:max-w-2xl">
          <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="bg-secondary text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                <FolderCog className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-lg">Manage Subjects</DialogTitle>
                <DialogDescription className="mt-1">
                  Create, rename, or remove the broad courses used to organize
                  your materials. Manage topics from each subject&apos;s Library
                  page.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <form
              className="bg-secondary/35 rounded-xl border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                createSubject();
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="manager-subject-name">New Subject</Label>
                  <Input
                    id="manager-subject-name"
                    name="subjectName"
                    value={createName}
                    onChange={(event) => {
                      setCreateName(event.target.value);
                      if (createError) setCreateError(null);
                    }}
                    placeholder="e.g. Physics…"
                    maxLength={60}
                    autoComplete="off"
                    aria-invalid={Boolean(createError)}
                    aria-describedby={
                      createError ? "manager-subject-error" : undefined
                    }
                    disabled={createPending}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createPending}
                  className="w-full shrink-0 sm:w-auto"
                >
                  {createPending ? (
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Plus className="size-4" aria-hidden="true" />
                  )}
                  {createPending ? "Creating…" : "Create & Select"}
                </Button>
              </div>
              {createError ? (
                <p
                  id="manager-subject-error"
                  className="text-destructive mt-2 text-sm"
                  role="alert"
                >
                  {createError}
                </p>
              ) : null}
            </form>

            <section
              className="mt-6"
              aria-labelledby="existing-subjects-heading"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="existing-subjects-heading" className="font-medium">
                  Existing Subjects
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {subjects.length}{" "}
                  {subjects.length === 1 ? "subject" : "subjects"}
                </span>
              </div>

              {subjects.length ? (
                <ul className="divide-y overflow-hidden rounded-xl border">
                  {subjects.map((subject) => {
                    const renamePending =
                      pending &&
                      mutation?.type === "rename" &&
                      mutation.id === subject.id;
                    const deletePending =
                      pending &&
                      mutation?.type === "delete" &&
                      mutation.id === subject.id;
                    return (
                      <li key={subject.id} className="bg-card p-4">
                        {renameId === subject.id ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              renameSubject(subject);
                            }}
                          >
                            <Label htmlFor={`manager-rename-${subject.id}`}>
                              Rename {subject.name}
                            </Label>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                              <Input
                                id={`manager-rename-${subject.id}`}
                                name="subjectName"
                                value={renameName}
                                onChange={(event) => {
                                  setRenameName(event.target.value);
                                  if (renameError) setRenameError(null);
                                }}
                                maxLength={60}
                                autoComplete="off"
                                aria-invalid={Boolean(renameError)}
                                disabled={renamePending}
                              />
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setRenameId(null)}
                                  disabled={renamePending}
                                >
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={renamePending}>
                                  {renamePending ? "Saving…" : "Save Name"}
                                </Button>
                              </div>
                            </div>
                            {renameError ? (
                              <p
                                className="text-destructive mt-2 text-sm"
                                role="alert"
                              >
                                {renameError}
                              </p>
                            ) : null}
                          </form>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <span
                              className="grid size-9 shrink-0 place-items-center rounded-lg"
                              style={{
                                backgroundColor: subject.color
                                  ? `${subject.color}1A`
                                  : "var(--secondary)",
                                color: subject.color ?? "var(--primary)",
                              }}
                            >
                              <BookOpen className="size-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate font-medium"
                                title={subject.name}
                              >
                                {subject.name}
                                {selectedSubjectId === subject.id ? (
                                  <span className="text-primary ml-2 text-xs font-medium">
                                    Selected
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                                {subject.topicCount}{" "}
                                {subject.topicCount === 1 ? "topic" : "topics"}{" "}
                                · {subject.materialCount}{" "}
                                {subject.materialCount === 1
                                  ? "material"
                                  : "materials"}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => beginRename(subject)}
                                disabled={pending}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                                Rename
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(subject)}
                                disabled={pending || deletePending}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
                  <BookOpen
                    className="text-primary size-7"
                    aria-hidden="true"
                  />
                  <p className="mt-3 font-medium">No Subjects Yet</p>
                  <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                    Create the broad course this material belongs to. LUMII will
                    suggest its topic after analysis.
                  </p>
                </div>
              )}
            </section>
            <p className="sr-only" aria-live="polite">
              {pending && mutation?.type === "rename"
                ? "Renaming subject"
                : pending && mutation?.type === "delete"
                  ? "Deleting subject"
                  : ""}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !pending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the subject and {deleteTarget?.topicCount ?? 0}{" "}
              active{" "}
              {(deleteTarget?.topicCount ?? 0) === 1 ? "topic" : "topics"}.{" "}
              {deleteTarget?.materialCount ?? 0}{" "}
              {(deleteTarget?.materialCount ?? 0) === 1
                ? "material is"
                : "materials are"}{" "}
              kept and moved to Needs Setup. Saved quiz attempts and mastery
              history remain available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              Keep Subject
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={deleteSubject}
              disabled={pending}
            >
              {pending && mutation?.type === "delete"
                ? "Deleting…"
                : "Delete Subject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
