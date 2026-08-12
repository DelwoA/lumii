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
  const [savedSubjectId, setSavedSubjectId] = useState(initialSubjectId ?? "");
  const [savedTopicId, setSavedTopicId] = useState(initialTopicId ?? "");
  const topics = useMemo(
    () => subjects.find((subject) => subject.id === subjectId)?.topics ?? [],
    [subjects, subjectId],
  );
  const subject = subjects.find((item) => item.id === savedSubjectId);
  const topic = subject?.topics.find((item) => item.id === savedTopicId);

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
        topicId: topicId || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Subject saved. LUMII can organize the topic next.");
      setSavedSubjectId(subjectId);
      setSavedTopicId(topicId);
      setEditing(false);
      router.replace(`/library/materials/${materialId}?setup=concepts`);
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
                : subject
                  ? `${subject.name} · Topic not confirmed yet`
                  : "Choose a subject to continue."}
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
            <Label htmlFor="organization-topic">Topic (optional)</Label>
            <Select
              value={topicId || null}
              items={Object.fromEntries(
                topics.map((topic) => [topic.id, topic.name]),
              )}
              onValueChange={(value) => setTopicId(value ?? "")}
              disabled={!subjectId || pending}
            >
              <SelectTrigger id="organization-topic" className="w-full">
                <SelectValue
                  placeholder={
                    subjectId
                      ? "Let LUMII suggest one"
                      : "Choose a subject first"
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
              disabled={pending || !subjectId}
            >
              <Check className="size-4" />{" "}
              {pending ? "Saving…" : "Save & Analyze"}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
