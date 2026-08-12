"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMaterialForAI } from "@/lib/materials/content";
import { proposeKnowledgeComponents } from "@/lib/ai/concepts";

const conceptInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(300),
  evidence: z.array(z.string().trim().min(3).max(240)).max(3),
  selected: z.boolean(),
});

const confirmInput = z.object({
  topicName: z.string().trim().min(2).max(80),
  concepts: z.array(conceptInput).min(1).max(8),
});

export type MaterialSetupProposal = {
  subject: { id: string; name: string };
  topic: { id: string | null; name: string; isExisting: boolean };
  concepts: Array<{
    name: string;
    description: string;
    evidence: string[];
  }>;
};

export type ProposeMaterialSetupResult =
  | { ok: true; proposal: MaterialSetupProposal }
  | { ok: false; error: string };

export type ConfirmMaterialSetupResult =
  | {
      ok: true;
      materialId: string;
      topic: { id: string; name: string };
      concepts: Array<{
        id: string;
        name: string;
        description: string;
        status: "CONFIRMED";
        evidence: string[];
      }>;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function normalizeName(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

export async function proposeMaterialSetup(
  materialId: string,
): Promise<ProposeMaterialSetupResult> {
  const user = await requireDbUser();
  const [loaded, material] = await Promise.all([
    loadMaterialForAI(user.id, materialId),
    prisma.material.findFirst({
      where: { id: materialId, userId: user.id },
      select: {
        subject: { select: { id: true, name: true } },
        topic: { select: { id: true, name: true } },
      },
    }),
  ]);
  if (!loaded || !material) {
    return { ok: false, error: "Material is not ready yet." };
  }
  if (!material.subject) {
    return {
      ok: false,
      error: "Choose a subject before analyzing this material.",
    };
  }

  try {
    const generated = await proposeKnowledgeComponents(
      loaded.content,
      material.subject.name,
      material.topic?.name,
    );
    const existingTopic = material.topic
      ? material.topic
      : await prisma.topic.findFirst({
          where: {
            userId: user.id,
            subjectId: material.subject.id,
            archivedAt: null,
            name: { equals: generated.topicName, mode: "insensitive" },
          },
          select: { id: true, name: true },
        });

    return {
      ok: true,
      proposal: {
        subject: material.subject,
        topic: {
          id: existingTopic?.id ?? null,
          name: existingTopic?.name ?? generated.topicName,
          isExisting: Boolean(existingTopic),
        },
        concepts: generated.concepts,
      },
    };
  } catch {
    return {
      ok: false,
      error: "LUMII could not analyze this material. Try again.",
    };
  }
}

export async function confirmMaterialSetup(
  materialId: string,
  input: unknown,
): Promise<ConfirmMaterialSetupResult> {
  const user = await requireDbUser();
  const parsed = confirmInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Review the suggested topic and concepts." };
  }
  const selected = parsed.data.concepts.filter((concept) => concept.selected);
  if (!selected.length) {
    return { ok: false, error: "Keep at least one quiz concept." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.material.findFirst({
        where: { id: materialId, userId: user.id },
        select: { id: true, subjectId: true, topicId: true },
      });
      if (!material?.subjectId) throw new Error("MATERIAL_NOT_FOUND");

      let topic = await tx.topic.findFirst({
        where: {
          userId: user.id,
          subjectId: material.subjectId,
          archivedAt: null,
          name: { equals: parsed.data.topicName, mode: "insensitive" },
        },
        select: { id: true, name: true },
      });
      topic ??= await tx.topic.create({
        data: {
          userId: user.id,
          subjectId: material.subjectId,
          name: parsed.data.topicName,
        },
        select: { id: true, name: true },
      });

      const oldLinks = await tx.materialKnowledgeComponent.findMany({
        where: { materialId, userId: user.id },
        select: { knowledgeComponentId: true },
      });
      await tx.materialKnowledgeComponent.deleteMany({
        where: { materialId, userId: user.id },
      });
      await tx.material.update({
        where: { id: materialId },
        data: { topicId: topic.id },
      });

      const confirmed = [];
      for (const concept of selected) {
        const normalizedName = normalizeName(concept.name);
        const component = await tx.knowledgeComponent.upsert({
          where: {
            topicId_normalizedName: { topicId: topic.id, normalizedName },
          },
          create: {
            userId: user.id,
            topicId: topic.id,
            name: concept.name,
            normalizedName,
            description: concept.description,
            status: "CONFIRMED",
            origin: "AI",
          },
          update: {
            name: concept.name,
            description: concept.description,
            status: "CONFIRMED",
          },
          select: { id: true, name: true, description: true },
        });
        await tx.materialKnowledgeComponent.create({
          data: {
            userId: user.id,
            materialId,
            knowledgeComponentId: component.id,
            evidence: { passages: concept.evidence },
          },
        });
        confirmed.push({
          ...component,
          status: "CONFIRMED" as const,
          evidence: concept.evidence,
        });
      }

      const oldIds = oldLinks.map((link) => link.knowledgeComponentId);
      if (oldIds.length) {
        await tx.knowledgeComponent.deleteMany({
          where: {
            id: { in: oldIds },
            userId: user.id,
            materials: { none: {} },
            questionAttempts: { none: {} },
            mastery: { none: {} },
            snapshots: { none: {} },
          },
        });
      }
      return { topic, confirmed };
    });

    revalidatePath("/library");
    revalidatePath(`/library/materials/${materialId}`);
    revalidatePath("/progress/mastery");
    revalidateTag(`user:${user.id}:subjects`, "max");
    return {
      ok: true,
      materialId,
      topic: result.topic,
      concepts: result.confirmed,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message === "MATERIAL_NOT_FOUND"
          ? "Material or subject not found."
          : "Could not save the topic and quiz concepts.",
    };
  }
}

// Compatibility aliases for older callers while the guided flow is consolidated.
export const proposeMaterialConcepts = proposeMaterialSetup;
