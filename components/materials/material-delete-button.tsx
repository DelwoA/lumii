// =============================================================================
// FILE: components/materials/material-delete-button.tsx
// WHAT THIS FILE DOES:
//   The Delete button on a material's detail page. It opens a confirm dialog and,
//   when confirmed, calls the delete-material server action and returns the user
//   to the materials list.
// =============================================================================
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteMaterial } from "@/app/(app)/materials/actions";

export function MaterialDeleteButton({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    const res = await deleteMaterial(materialId);
    setBusy(false);
    if (res.ok) {
      toast.success("Material deleted");
      router.push("/materials");
    } else {
      toast.error(res.error ?? "Could not delete");
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-destructive gap-2">
            <Trash2 className="size-4" />
            Delete
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this material?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the file and any generated summaries. This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
