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
import { MoreVertical, Trash2 } from "lucide-react";
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
import { deleteSubject, deleteTopic } from "@/app/(app)/subjects/actions";

/**
 * A "⋯" actions menu (currently just Delete, with confirmation) for a subject
 * or topic. Hard-deletes via the server action; the user's materials are kept
 * (only unassigned). On a subject's own page, pass redirectTo to leave the page
 * after deletion; elsewhere the list just refreshes.
 */
export function DeleteMenu({
  kind,
  id,
  name,
  redirectTo,
}: {
  kind: "subject" | "topic";
  id: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    const res = kind === "subject" ? await deleteSubject(id) : await deleteTopic(id);
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${name} actions`}
            >
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete {kind}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {kind}?</AlertDialogTitle>
            <AlertDialogDescription>
              {kind === "subject"
                ? `This permanently deletes “${name}” and its topics. Your materials are kept (just unassigned). This can't be undone.`
                : `This permanently deletes the topic “${name}”. Your materials are kept (just unassigned). This can't be undone.`}
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
