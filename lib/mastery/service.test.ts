import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAttempts: vi.fn(),
  deleteMastery: vi.fn(),
  upsertMastery: vi.fn(),
  upsertSnapshot: vi.fn(),
  findComponents: vi.fn(),
  findOverviewComponents: vi.fn(),
  findSnapshots: vi.fn(),
  predictNextCorrect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    quizQuestionAttempt: { findMany: mocks.findAttempts },
    studentConceptMastery: {
      deleteMany: mocks.deleteMastery,
      upsert: mocks.upsertMastery,
    },
    masterySnapshot: {
      upsert: mocks.upsertSnapshot,
      findMany: mocks.findSnapshots,
    },
    knowledgeComponent: {
      findMany: mocks.findComponents,
    },
  },
}));
vi.mock("@/lib/mastery/inference", () => ({
  predictNextCorrect: mocks.predictNextCorrect,
}));

import { BKT_MODEL_VERSION } from "./bkt";
import { recomputeMasteryForComponents } from "./service";

describe("recomputeMasteryForComponents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteMastery.mockResolvedValue({ count: 0 });
    mocks.predictNextCorrect.mockResolvedValue({
      status: "disabled",
      reason: "Deep inference feature flag is off",
    });
    mocks.upsertMastery.mockImplementation(
      async (input: { create: Record<string, unknown> }) => ({
        id: "mastery-1",
        ...input.create,
      }),
    );
    mocks.upsertSnapshot.mockResolvedValue({ id: "snapshot-1" });
  });

  it("persists BKT state and an auditable snapshot", async () => {
    const createdAt = new Date("2026-08-01T00:00:00Z");
    mocks.findAttempts.mockResolvedValue([
      {
        knowledgeComponentId: "component-1",
        isCorrect: true,
        responseTimeMs: 1_200,
        createdAt,
        difficulty: "MEDIUM",
      },
      {
        knowledgeComponentId: "component-1",
        isCorrect: false,
        responseTimeMs: 1_800,
        createdAt: new Date(createdAt.getTime() + 1_000),
        difficulty: "HARD",
      },
      {
        knowledgeComponentId: "component-1",
        isCorrect: true,
        responseTimeMs: 900,
        createdAt: new Date(createdAt.getTime() + 2_000),
        difficulty: "EASY",
      },
    ]);

    const result = await recomputeMasteryForComponents({
      userId: "user-1",
      componentIds: ["component-1", "component-1"],
      quizCompletionId: "quiz-1",
    });

    expect(mocks.findAttempts).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", knowledgeComponentId: { not: null } },
      }),
    );
    expect(mocks.upsertMastery).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: "user-1",
          knowledgeComponentId: "component-1",
          evidenceCount: 3,
          source: "BKT",
          modelVersion: BKT_MODEL_VERSION,
        }),
      }),
    );
    expect(mocks.upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          quizCompletionId: "quiz-1",
          source: "BKT",
          modelVersion: BKT_MODEL_VERSION,
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("removes stale mastery when the remaining history is empty", async () => {
    mocks.findAttempts.mockResolvedValue([]);

    await recomputeMasteryForComponents({
      userId: "user-1",
      componentIds: ["component-1"],
    });

    expect(mocks.deleteMastery).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        knowledgeComponentId: "component-1",
      },
    });
    expect(mocks.upsertMastery).not.toHaveBeenCalled();
    expect(mocks.upsertSnapshot).not.toHaveBeenCalled();
  });
});
