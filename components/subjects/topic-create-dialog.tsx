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
import { createTopic } from "@/app/(app)/subjects/actions";
import { ACTION_INITIAL, type ActionState } from "@/lib/forms";

export function TopicCreateDialog({ subjectId }: { subjectId: string }) {
  const [open, setOpen] = useState(false);
  // Bind the subjectId so useActionState calls (prev, formData) -> action.
  const action = createTopic.bind(null, subjectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      toast.success("Topic added");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="size-4" />
            Add topic
          </Button>
        }
      />
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Add topic</DialogTitle>
            <DialogDescription>
              Topics break a subject into focused areas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="topic-name">Name</Label>
            <Input
              id="topic-name"
              name="name"
              placeholder="e.g. Process scheduling"
              autoFocus
              maxLength={60}
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
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add topic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
