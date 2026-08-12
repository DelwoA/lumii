"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { updateMaterialOrganization } from "@/app/(app)/materials/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SubjectOption = {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
};

export function MaterialOrganization({
  materialId,
  subjects,
  initialSubjectId,
  initialTopicId,
  autoFocus,
}: {
  materialId: string;
  subjects: SubjectOption[];
  initialSubjectId: string | null;
  initialTopicId: string | null;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(
    !initialSubjectId || !initialTopicId || autoFocus,
  );
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [topicId, setTopicId] = useState(initialTopicId ?? "");
  const topics = useMemo(
    () => subjects.find((subject) => subject.id === subjectId)?.topics ?? [],
    [subjects, subjectId],
  );
  const subject = subjects.find((item) => item.id === initialSubjectId);
  const topic = subject?.topics.find((item) => item.id === initialTopicId);

  useEffect(() => {
    if (!autoFocus) return;
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    headingRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  function save() {
    startTransition(async () => {
      const result = await updateMaterialOrganization({
        materialId,
        subjectId,
        topicId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Organization updated. Review the new concept map next.");
      setEditing(false);
      router.refresh();
      window.setTimeout(() => {
        const target = document.getElementById("concept-setup");
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        target?.focus({ preventScroll: true });
      }, 100);
    });
  }

  return (
    <Card id="material-organization" className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <FolderTree className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-medium outline-none"
            >
              Organization
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {subject && topic
                ? `${subject.name} › ${topic.name}`
                : "Choose a subject and topic to continue."}
            </p>
          </div>
        </div>
        {!editing ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="organization-subject">Subject</Label>
            <Select
              value={subjectId || null}
              items={Object.fromEntries(
                subjects.map((subject) => [subject.id, subject.name]),
              )}
              onValueChange={(value) => {
                setSubjectId(value ?? "");
                setTopicId("");
              }}
              disabled={pending}
            >
              <SelectTrigger
                id="organization-subject"
                className="w-full"
                aria-invalid={!subjectId}
              >
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization-topic">Topic</Label>
            <Select
              value={topicId || null}
              items={Object.fromEntries(
                topics.map((topic) => [topic.id, topic.name]),
              )}
              onValueChange={(value) => setTopicId(value ?? "")}
              disabled={!subjectId || pending}
            >
              <SelectTrigger
                id="organization-topic"
                className="w-full"
                aria-invalid={Boolean(subjectId && !topicId)}
              >
                <SelectValue
                  placeholder={
                    subjectId ? "Choose a topic" : "Choose a subject first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {topics.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            {initialSubjectId && initialTopicId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSubjectId(initialSubjectId);
                  setTopicId(initialTopicId);
                  setEditing(false);
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={save}
              disabled={pending || !subjectId || !topicId}
            >
              <Check className="size-4" />{" "}
              {pending ? "Saving…" : "Save organization"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
