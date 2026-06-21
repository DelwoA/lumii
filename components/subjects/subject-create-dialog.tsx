"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSubject } from "@/app/(app)/subjects/actions";
import { ACTION_INITIAL, type ActionState } from "@/lib/forms";
import { SUBJECT_COLORS } from "@/lib/validations/subject";

export function SubjectCreateDialog() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0]);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSubject,
    ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success("Subject created");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Plus className="size-4" />
            New subject
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>New subject</DialogTitle>
            <DialogDescription>
              Group your study materials and topics under a subject.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subject-name">Name</Label>
              <Input
                id="subject-name"
                name="name"
                placeholder="e.g. Operating Systems"
                autoFocus
                maxLength={60}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Colour</Label>
              <input type="hidden" name="color" value={color} />
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    onClick={() => setColor(c)}
                    className={`ring-offset-background size-6 rounded-full ring-2 ring-offset-2 transition ${
                      color === c ? "ring-foreground" : "ring-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
