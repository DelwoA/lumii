"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadMaterialForAI } from "@/lib/materials/content";
import { proposeKnowledgeComponents } from "@/lib/ai/concepts";

const confirmSchema = z.array(
  z.object({
    id: z.string().min(1),
    selected: z.boolean(),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(10).max(300),
  }),
);

export type ConceptActionResult = { ok: true } | { ok: false; error: string };

function normalizeConceptName(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

export async function proposeMaterialConcepts(
  materialId: string,
): Promise<ConceptActionResult> {
  const user = await requireDbUser();
  const loaded = await loadMaterialForAI(user.id, materialId);
  if (!loaded) return { ok: false, error: "Material is not ready yet" };
  if (!loaded.topicId) {
    return {
      ok: false,
      error: "Assign this material to a topic before setting up mastery.",
    };
  }

  const topic = await prisma.topic.findFirst({
    where: { id: loaded.topicId, userId: user.id, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!topic) return { ok: false, error: "The selected topic is unavailable." };

  try {
    const proposal = await proposeKnowledgeComponents(
      loaded.content,
      topic.name,
    );
    const existing = await prisma.knowledgeComponent.findMany({
      where: { userId: user.id, topicId: topic.id },
    });
    const byName = new Map(
      existing.map((component) => [component.normalizedName, component]),
    );

    await prisma.$transaction(async (tx) => {
      for (const concept of proposal.concepts) {
        const normalizedName = normalizeConceptName(concept.name);
        const match = byName.get(normalizedName);
        const component = match
          ? await tx.knowledgeComponent.update({
              where: { id: match.id },
              data:
                match.status === "ARCHIVED"
                  ? { status: "PROPOSED", description: concept.description }
                  : {},
            })
          : await tx.knowledgeComponent.create({
              data: {
                userId: user.id,
                topicId: topic.id,
                name: concept.name.trim(),
                normalizedName,
                description: concept.description.trim(),
                status: "PROPOSED",
                origin: "AI",
              },
            });
        await tx.materialKnowledgeComponent.upsert({
          where: {
            materialId_knowledgeComponentId: {
              materialId,
              knowledgeComponentId: component.id,
            },
          },
          create: {
            userId: user.id,
            materialId,
            knowledgeComponentId: component.id,
            evidence: {
              passages: concept.evidence,
              modelId: proposal.modelId,
            },
          },
          update: {
            evidence: {
              passages: concept.evidence,
              modelId: proposal.modelId,
            },
          },
        });
      }
    });
    revalidatePath(`/materials/${materialId}`);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Could not map concepts from this material. Please try again.",
    };
  }
}

export async function confirmMaterialConcepts(
  materialId: string,
  input: unknown,
): Promise<ConceptActionResult> {
  const user = await requireDbUser();
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success || parsed.data.length === 0) {
    return { ok: false, error: "Review at least one concept." };
  }
  const selected = parsed.data.filter((item) => item.selected);
  if (selected.length === 0) {
    return { ok: false, error: "Keep at least one concept for this material." };
  }

  const material = await prisma.material.findFirst({
    where: { id: materialId, userId: user.id },
    select: {
      topicId: true,
      knowledgeComponents: {
        select: { knowledgeComponent: { select: { id: true, topicId: true } } },
      },
    },
  });
  if (!material?.topicId) return { ok: false, error: "Material not found." };
  const allowed = new Set(
    material.knowledgeComponents.map((link) => link.knowledgeComponent.id),
  );
  if (parsed.data.some((item) => !allowed.has(item.id))) {
    return { ok: false, error: "A concept does not belong to this material." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of parsed.data) {
        if (item.selected) {
          await tx.knowledgeComponent.update({
            where: { id: item.id },
            data: {
              name: item.name,
              normalizedName: normalizeConceptName(item.name),
              description: item.description,
              status: "CONFIRMED",
            },
          });
        } else {
          await tx.materialKnowledgeComponent.deleteMany({
            where: {
              userId: user.id,
              materialId,
              knowledgeComponentId: item.id,
            },
          });
          const useCount = await tx.materialKnowledgeComponent.count({
            where: { knowledgeComponentId: item.id },
          });
          if (useCount === 0) {
            await tx.knowledgeComponent.deleteMany({
              where: {
                id: item.id,
                userId: user.id,
                status: "PROPOSED",
                questionAttempts: { none: {} },
              },
            });
          }
        }
      }
    });
    revalidatePath(`/materials/${materialId}`);
    revalidatePath("/progress/mastery");
    return { ok: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        error: "Two concepts have the same name. Combine or rename them.",
      };
    }
    return { ok: false, error: "Could not save the concept map." };
  }
}
