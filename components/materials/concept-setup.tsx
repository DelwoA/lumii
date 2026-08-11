"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Check, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmMaterialConcepts,
  proposeMaterialConcepts,
} from "@/app/(app)/materials/concept-actions";

export type MaterialConcept = {
  id: string;
  name: string;
  description: string;
  status: "PROPOSED" | "CONFIRMED" | "ARCHIVED";
  evidence: string[];
};

export function ConceptSetup({
  materialId,
  topicName,
  initialConcepts,
}: {
  materialId: string;
  topicName: string | null;
  initialConcepts: MaterialConcept[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [concepts, setConcepts] = useState(
    initialConcepts.map((concept) => ({ ...concept, selected: true })),
  );
  const proposed = concepts.filter((concept) => concept.status === "PROPOSED");
  const confirmed = concepts.filter(
    (concept) => concept.status === "CONFIRMED",
  );

  function generate() {
    startTransition(async () => {
      const result = await proposeMaterialConcepts(materialId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Concept map ready to review");
      router.refresh();
    });
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmMaterialConcepts(
        materialId,
        proposed.map(({ id, name, description, selected }) => ({
          id,
          name,
          description,
          selected,
        })),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Concept map confirmed");
      router.refresh();
    });
  }

  if (!topicName) {
    return (
      <Card className="border-dashed p-5">
        <div className="flex gap-3">
          <Sprout className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <h3 className="font-medium">Choose a topic to track mastery</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Edit this material from the Materials page and assign it to a
              subject and topic. LUMII can then map the concepts it teaches.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (proposed.length === 0) {
    return (
      <Card className="bg-secondary/35 p-5">
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
                  ? `${confirmed.length} mastery ${confirmed.length === 1 ? "concept" : "concepts"}`
                  : "Set up mastery for this material"}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {confirmed.length
                  ? confirmed.map((concept) => concept.name).join(" · ")
                  : `LUMII will propose the assessable concepts inside ${topicName}. You review them before any quiz uses them.`}
              </p>
            </div>
          </div>
          <Button onClick={generate} disabled={pending} variant="outline">
            {pending
              ? "Mapping…"
              : confirmed.length
                ? "Find more concepts"
                : "Map concepts"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-secondary/45 border-b p-5">
        <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
          Review before tracking
        </p>
        <h3 className="mt-1 font-medium">Concept map for {topicName}</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Keep, rename, or remove these suggestions. Confirmed concepts become
          the rows in your mastery map.
        </p>
      </div>
      <div className="divide-y">
        {proposed.map((concept, index) => (
          <div
            key={concept.id}
            className="grid gap-3 p-5 sm:grid-cols-[auto_1fr]"
          >
            <Checkbox
              id={`concept-${concept.id}`}
              checked={concept.selected}
              onCheckedChange={(checked) =>
                setConcepts((current) =>
                  current.map((item) =>
                    item.id === concept.id
                      ? { ...item, selected: checked === true }
                      : item,
                  ),
                )
              }
              className="mt-2"
            />
            <div className="grid gap-3">
              <div>
                <Label htmlFor={`concept-name-${concept.id}`}>
                  Concept {index + 1}
                </Label>
                <Input
                  id={`concept-name-${concept.id}`}
                  value={concept.name}
                  disabled={!concept.selected || pending}
                  onChange={(event) =>
                    setConcepts((current) =>
                      current.map((item) =>
                        item.id === concept.id
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor={`concept-description-${concept.id}`}>
                  What this measures
                </Label>
                <Textarea
                  id={`concept-description-${concept.id}`}
                  value={concept.description}
                  disabled={!concept.selected || pending}
                  onChange={(event) =>
                    setConcepts((current) =>
                      current.map((item) =>
                        item.id === concept.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    )
                  }
                  className="mt-1.5 min-h-20"
                />
              </div>
              {concept.evidence.length ? (
                <p className="text-muted-foreground text-xs">
                  Found in the material: “{concept.evidence[0]}”
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-muted/35 flex justify-end border-t p-4">
        <Button onClick={confirm} disabled={pending}>
          {pending ? "Saving…" : "Confirm concept map"}
        </Button>
      </div>
    </Card>
  );
}
