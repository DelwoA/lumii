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
  modelVersion: string | null;
  updatedAt: string | null;
  materialId: string | null;
  materialTitle: string | null;
};

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
};
