"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BrainCircuit, Check, RefreshCw, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmMaterialSetup,
  proposeMaterialSetup,
  type MaterialSetupProposal,
} from "@/app/(app)/materials/concept-actions";

export type MaterialConcept = {
  id: string;
  name: string;
  description: string;
  status: "PROPOSED" | "CONFIRMED" | "ARCHIVED";
  evidence: string[];
};

type EditableConcept = MaterialSetupProposal["concepts"][number] & {
  selected: boolean;
};

export function ConceptSetup({
  materialId,
  subjectName,
  topicName,
  initialConcepts,
  autoFocus,
  onConfirmed,
}: {
  materialId: string;
  subjectName: string | null;
  topicName: string | null;
  initialConcepts: MaterialConcept[];
  autoFocus?: boolean;
  onConfirmed: (result: {
    topic: { id: string; name: string };
    concepts: MaterialConcept[];
  }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "analyzing" | "review">(() =>
    initialConcepts.some((concept) => concept.status === "PROPOSED")
      ? "review"
      : "idle",
  );
  const [suggestedTopic, setSuggestedTopic] = useState(topicName ?? "");
  const [concepts, setConcepts] = useState<EditableConcept[]>(() =>
    initialConcepts
      .filter((concept) => concept.status === "PROPOSED")
      .map(({ name, description, evidence }) => ({
        name,
        description,
        evidence,
        selected: true,
      })),
  );
  const confirmed = initialConcepts.filter(
    (concept) => concept.status === "CONFIRMED",
  );
  const sectionRef = useRef<HTMLDivElement>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!autoFocus) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    sectionRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const analyze = useCallback(() => {
    setPhase("analyzing");
    startTransition(async () => {
      const result = await proposeMaterialSetup(materialId);
      if (!result.ok) {
        setPhase("idle");
        toast.error(result.error);
        return;
      }
      setSuggestedTopic(result.proposal.topic.name);
      setConcepts(
        result.proposal.concepts.map((concept) => ({
          ...concept,
          selected: true,
        })),
      );
      setPhase("review");
      toast.success("Topic and quiz concepts are ready to review");
      requestAnimationFrame(() => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }, [materialId]);

  useEffect(() => {
    if (
      !autoFocus ||
      !subjectName ||
      confirmed.length > 0 ||
      phase !== "idle" ||
      autoStartedRef.current
    ) {
      return;
    }
    autoStartedRef.current = true;
    analyze();
  }, [analyze, autoFocus, confirmed.length, phase, subjectName]);

  function confirm() {
    startTransition(async () => {
      const result = await confirmMaterialSetup(materialId, {
        topicName: suggestedTopic,
        concepts,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Setup confirmed. Creating your Quick Quiz…");
      setPhase("idle");
      onConfirmed({ topic: result.topic, concepts: result.concepts });
    });
  }

  if (!subjectName) {
    return (
      <Card
        id="concept-setup"
        ref={sectionRef}
        tabIndex={-1}
        className="border-dashed p-5 outline-none"
      >
        <div className="flex gap-3">
          <Sprout className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <h3 className="font-medium">Choose a Subject</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Choose the course this material belongs to, then LUMII can suggest
              its topic and quiz concepts.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (phase === "analyzing") {
    return (
      <Card
        id="concept-setup"
        ref={sectionRef}
        tabIndex={-1}
        className="overflow-hidden p-0 outline-none"
        aria-live="polite"
      >
        <div className="bg-secondary/45 border-b p-5">
          <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
            AI Organizes
          </p>
          <h3 className="mt-1 font-medium">Reading Your Material…</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            LUMII is identifying one topic and the concepts a quiz can assess.
          </p>
        </div>
        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
          {[0, 1, 2].map((index) => (
            <div key={index} className="grid grid-cols-[1rem_1fr] gap-3">
              <Skeleton className="mt-1 size-4" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (phase === "review") {
    return (
      <Card
        id="concept-setup"
        ref={sectionRef}
        tabIndex={-1}
        className="overflow-hidden p-0 outline-none"
      >
        <div className="bg-secondary/45 border-b p-5">
          <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
            Review
          </p>
          <h3 className="mt-1 font-medium">Check the Topic & Quiz Concepts</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Nothing below is saved until you confirm it.
          </p>
        </div>
        <div className="space-y-5 p-5">
          <div className="space-y-2">
            <Label htmlFor="suggested-topic">Topic in {subjectName}</Label>
            <Input
              id="suggested-topic"
              value={suggestedTopic}
              onChange={(event) => setSuggestedTopic(event.target.value)}
              maxLength={80}
              disabled={pending}
              autoComplete="off"
            />
          </div>
          <div className="divide-y rounded-xl border">
            {concepts.map((concept, index) => (
              <div
                key={`${index}-${concept.name}`}
                className="grid gap-3 p-4 sm:grid-cols-[auto_1fr]"
              >
                <Checkbox
                  id={`setup-concept-${index}`}
                  checked={concept.selected}
                  onCheckedChange={(checked) =>
                    setConcepts((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, selected: checked === true }
                          : item,
                      ),
                    )
                  }
                  className="mt-2"
                />
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`setup-concept-name-${index}`}>
                      Quiz Concept {index + 1}
                    </Label>
                    <Input
                      id={`setup-concept-name-${index}`}
                      value={concept.name}
                      onChange={(event) =>
                        setConcepts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                      disabled={!concept.selected || pending}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`setup-concept-description-${index}`}>
                      What the Quiz Will Assess
                    </Label>
                    <Textarea
                      id={`setup-concept-description-${index}`}
                      value={concept.description}
                      onChange={(event) =>
                        setConcepts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, description: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="min-h-16"
                      disabled={!concept.selected || pending}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-muted/35 flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={analyze}
            disabled={pending}
          >
            <RefreshCw className="size-4" /> Analyze Again
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={
              pending ||
              suggestedTopic.trim().length < 2 ||
              !concepts.some((concept) => concept.selected)
            }
          >
            {pending ? "Confirming…" : "Confirm & Start Quick Quiz"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      id="concept-setup"
      ref={sectionRef}
      tabIndex={-1}
      className="bg-secondary/35 p-5 outline-none"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          {confirmed.length ? (
            <Check className="text-primary mt-0.5 size-5 shrink-0" />
          ) : (
            <BrainCircuit className="text-primary mt-0.5 size-5 shrink-0" />
          )}
          <div>
            <h3 className="font-medium">
              {confirmed.length
                ? `${confirmed.length} Quiz ${confirmed.length === 1 ? "Concept" : "Concepts"}`
                : "Let LUMII Organize This Material"}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {confirmed.length
                ? `${subjectName} › ${topicName}: ${confirmed.map((concept) => concept.name).join(" · ")}`
                : "LUMII will suggest one topic and a short, reviewable set of quiz concepts."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={analyze}
          disabled={pending}
          variant="outline"
        >
          {confirmed.length ? "Analyze Again" : "Analyze Material"}
        </Button>
      </div>
    </Card>
  );
}
