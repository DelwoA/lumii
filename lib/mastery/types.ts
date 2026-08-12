export type MasterySummary = {
  componentId: string;
  componentName: string;
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  masteryProbability: number | null;
  nextCorrectProbability: number | null;
  evidenceCount: number;
  source: "BKT" | "DEEP" | "BKT_FALLBACK" | null;
  updatedAt: string | null;
  materialId: string | null;
  materialTitle: string | null;
};

export type RecommendationReason =
  | "BUILD_COVERAGE"
  | "STRENGTHEN_WEAKNESS"
  | "SPACED_REVIEW";

export type MasteryTrendPoint = {
  componentId: string;
  masteryProbability: number;
  nextCorrectProbability: number;
  evidenceCount: number;
  source: "BKT" | "DEEP" | "BKT_FALLBACK";
  createdAt: string;
};

export type MasteryOverview = {
  components: MasterySummary[];
  trends: MasteryTrendPoint[];
  recommendation: MasterySummary | null;
  recommendationReason: RecommendationReason | null;
};
