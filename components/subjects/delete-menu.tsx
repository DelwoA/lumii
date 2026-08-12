// =============================================================================
// FILE: components/subjects/delete-menu.tsx
// WHAT THIS FILE DOES:
//   The "..." menu on a subject or topic that offers Delete. Clicking Delete
//   opens a confirm dialog (which clearly says materials are kept), then calls
//   the delete server action and refreshes the page (or redirects). Reused for
//   both subjects and topics via its `kind` prop.
// =============================================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  deleteSubject,
  deleteTopic,
  renameSubject,
  renameTopic,
} from "@/app/(app)/subjects/actions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * An actions menu for a subject or topic. The visible organizer is removed,
 * while materials and historical learning evidence remain available. On a
 * subject's own page, pass redirectTo to leave after deletion; elsewhere the
 * list just refreshes.
 */
export function DeleteMenu({
  kind,
  id,
  name,
  redirectTo,
  triggerLabel,
}: {
  kind: "subject" | "topic";
  id: string;
  name: string;
  redirectTo?: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nextName, setNextName] = useState(name);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    const res =
      kind === "subject" ? await deleteSubject(id) : await deleteTopic(id);
    setBusy(false);
    if (res.ok) {
      toast.success(kind === "subject" ? "Subject deleted" : "Topic deleted");
      setConfirmOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } else {
      toast.error(res.error ?? "Could not delete");
    }
  }

  async function onRename() {
    if (!nextName.trim()) return;
    setBusy(true);
    const res =
      kind === "subject"
        ? await renameSubject(id, nextName)
        : await renameTopic(id, nextName);
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Could not rename");
    toast.success(kind === "subject" ? "Subject renamed" : "Topic renamed");
    setRenameOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={triggerLabel ? "outline" : "ghost"}
              size={triggerLabel ? "sm" : "icon-sm"}
              aria-label={`${name} actions`}
              className={triggerLabel ? "gap-2 whitespace-nowrap" : undefined}
            >
              <MoreVertical className="size-4" aria-hidden="true" />
              {triggerLabel ? triggerLabel : null}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-max min-w-max">
          <DropdownMenuItem
            className="whitespace-nowrap"
            onClick={() => setRenameOpen(true)}
          >
            <Pencil className="size-4" aria-hidden="true" />
            Rename {kind}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="whitespace-nowrap"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete {kind}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {kind}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor={`rename-${kind}-${id}`}>Name</Label>
            <Input
              id={`rename-${kind}-${id}`}
              value={nextName}
              onChange={(event) => setNextName(event.target.value)}
              maxLength={60}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={onRename} disabled={busy || !nextName.trim()}>
              {busy ? "Saving…" : "Save name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              {kind === "subject"
                ? `This removes “${name}” and its topics from your Library. Its materials move to Needs Setup; saved quiz attempts and mastery history remain. This can't be undone.`
                : `This removes the topic “${name}”. Its materials become uncategorized in the subject; saved quiz attempts and mastery history remain. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
