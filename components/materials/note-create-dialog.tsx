"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createNote } from "@/app/(app)/materials/actions";
import { ACTION_INITIAL, type ActionState } from "@/lib/forms";

export function NoteCreateDialog({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createNote,
    ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success("Note saved");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2">
            <PenLine className="size-4" />
            Add note
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Add a typed note</DialogTitle>
            <DialogDescription>
              Paste or write notes to summarise, quiz, and chat about.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="n-title">Title</Label>
              <Input id="n-title" name="title" required maxLength={120} />
            </div>
            {subjects.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="n-subject">Subject (optional)</Label>
                <select
                  id="n-subject"
                  name="subjectId"
                  className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <option value="">None</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="n-text">Notes</Label>
              <Textarea id="n-text" name="text" required rows={8} maxLength={50000} />
            </div>
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
