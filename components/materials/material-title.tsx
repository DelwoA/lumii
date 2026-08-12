"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { renameMaterial } from "@/app/(app)/materials/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MaterialTitle({
  materialId,
  initialTitle,
}: {
  materialId: string;
  initialTitle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    const nextTitle = draft.trim().replace(/\s+/g, " ");
    startTransition(async () => {
      const result = await renameMaterial({ materialId, title: nextTitle });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle(nextTitle);
      setOpen(false);
      toast.success("Material renamed");
    });
  }

  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words sm:text-3xl">
        {title}
      </h1>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setDraft(title);
        }}
      >
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Rename material"
              className="mt-0.5 shrink-0"
            >
              <Pencil className="size-4" />
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename material</DialogTitle>
            <DialogDescription>
              This is the one name shown throughout your Study Library.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            <Label htmlFor="material-name">Material name</Label>
            <Input
              id="material-name"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={120}
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={pending || draft.trim().length < 2}
            >
              {pending ? "Saving…" : "Save name"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
