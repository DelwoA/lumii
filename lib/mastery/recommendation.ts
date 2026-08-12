import type { MasterySummary, RecommendationReason } from "@/lib/mastery/types";

const MINIMUM_EVIDENCE = 3;
const REVIEW_COOLDOWN_MS = 24 * 60 * 60 * 1_000;

function lastPractisedAt(item: MasterySummary) {
  if (!item.updatedAt) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(item.updatedAt);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function stableNameOrder(a: MasterySummary, b: MasterySummary) {
  return (
    a.subjectName.localeCompare(b.subjectName) ||
    a.topicName.localeCompare(b.topicName) ||
    a.componentName.localeCompare(b.componentName) ||
    a.componentId.localeCompare(b.componentId)
  );
}

function coverageOrder(a: MasterySummary, b: MasterySummary) {
  return (
    a.evidenceCount - b.evidenceCount ||
    lastPractisedAt(a) - lastPractisedAt(b) ||
    stableNameOrder(a, b)
  );
}

function weakestOrder(a: MasterySummary, b: MasterySummary) {
  return (
    (a.masteryProbability ?? 1) - (b.masteryProbability ?? 1) ||
    lastPractisedAt(a) - lastPractisedAt(b) ||
    stableNameOrder(a, b)
  );
}

function oldestOrder(a: MasterySummary, b: MasterySummary) {
  return lastPractisedAt(a) - lastPractisedAt(b) || stableNameOrder(a, b);
}

export function chooseMasteryRecommendation(
  components: MasterySummary[],
  now = new Date(),
): {
  recommendation: MasterySummary | null;
  recommendationReason: RecommendationReason | null;
} {
  const practiceable = components.filter((item) => item.materialId);
  if (!practiceable.length) {
    return { recommendation: null, recommendationReason: null };
  }

  const needsCoverage = practiceable
    .filter((item) => item.evidenceCount < MINIMUM_EVIDENCE)
    .sort(coverageOrder);
  if (needsCoverage[0]) {
    return {
      recommendation: needsCoverage[0],
      recommendationReason: "BUILD_COVERAGE",
    };
  }

  const cooldownThreshold = now.getTime() - REVIEW_COOLDOWN_MS;
  const readyForReview = practiceable
    .filter((item) => lastPractisedAt(item) <= cooldownThreshold)
    .sort(weakestOrder);
  if (readyForReview[0]) {
    return {
      recommendation: readyForReview[0],
      recommendationReason: "STRENGTHEN_WEAKNESS",
    };
  }

  return {
    recommendation: [...practiceable].sort(oldestOrder)[0] ?? null,
    recommendationReason: "SPACED_REVIEW",
  };
}
