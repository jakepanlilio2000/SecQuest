export interface SecurityConcept {
  id: string;
  name: string;
  definition: string;
  explanation: string;
  objectives: string[];
  difficulty: "easy" | "medium" | "hard" | "expert";
  examples: string[];
  references: string[];
  validationStatus: "editorial-reviewed" | "draft";
  glossaryTerm: string;
}
export interface ConceptRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "prerequisite" | "builds_on" | "related" | "confused_with" | "next";
  status: "validated" | "draft";
  rationale: string;
  references: string[];
}
export interface MisconceptionDefinition {
  id: string;
  title: string;
  description: string;
  incorrectBelief: string;
  correctExplanation: string;
  objectives: string[];
  conceptIds: string[];
  assumptions: string[];
  examples: string[];
  questionIds: string[];
  prerequisiteIds: string[];
  comparison: { label: string; meaning: string }[];
  references: string[];
  validationStatus: "editorial-reviewed" | "draft";
}
export interface MisconceptionMapping {
  questionId: string;
  revision: number;
  optionId: string;
  slot: number;
  misconceptionId: string;
  weight: number;
  status: "validated" | "draft";
}
export interface IntelligencePolicy {
  version: string;
  possibleDistinct: number;
  likelyDistinct: number;
  recurringDistinct: number;
  resolutionDistinct: number;
  halfLifeDays: number;
  minimumIndependentHours: number;
  minimumForecastReviews: number;
  minimumForecastSuccesses: number;
  forecastAnchor: number;
  reviewSoonDays: number;
  minimumCalibrationSamples: number;
}
export type MisconceptionStatus =
  | "Insufficient evidence"
  | "Possible misconception"
  | "Likely misconception"
  | "Recurring misconception"
  | "Improving"
  | "Currently controlled";
export interface EvidenceRow {
  attempt_id: string;
  misconception_id: string;
  user_id: string;
  polarity: number;
  weight: number;
  independent: number;
  created_at: string;
  question_id: string;
  correct: number;
  confidence: string | null;
  retention: number;
  first_attempt: number;
  concept: string;
}
export interface MisconceptionFinding {
  definition: MisconceptionDefinition;
  status: MisconceptionStatus;
  support: number;
  confidence: "insufficient" | "limited" | "moderate";
  distinctMistakes: number;
  distinctCorrections: number;
  recentMistakes: number;
  lastMistakeAt: string | null;
  lastCorrectionAt: string | null;
  trend: string;
  reason: string;
  modelVersion: string;
  evidence: EvidenceRow[];
}
export interface ConceptPerformance {
  id: string;
  mastery: number | null;
  firstAccuracy: number | null;
  distinctQuestions: number;
  delayedReviews: number;
  lastReviewAt: string | null;
  status:
    | "Not studied"
    | "Insufficient evidence"
    | "Needs improvement"
    | "Developing mastery"
    | "Proficient"
    | "Strongly retained";
}
export interface NotebookEntry {
  id: string;
  user_id: string;
  notebook_id: string | null;
  title: string;
  body: string;
  format: string;
  category: string;
  objective: string | null;
  concept_id: string | null;
  question_id: string | null;
  question_revision: number | null;
  source_refs: string;
  study_url: string;
  pinned: number;
  origin_key: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  tags: string[];
}
export interface QuestionForecast {
  questionId: string;
  conceptIds: string[];
  concept: string;
  dueAt: string | null;
  lastAt: string | null;
  scheduledState:
    "Unscheduled" | "Upcoming" | "Review Soon" | "Review Due" | "Overdue";
  retentionState: "Insufficient Data" | "Well Retained" | "Review Soon";
  probability: number | null;
  stabilityDays: number | null;
  successfulAt: string | null;
  independentReviews: number;
  priority: number;
  reason: string;
  uncertainty: string;
  modelVersion: string;
  noteCount: number;
  history: { at: string; correct: boolean; kind: string }[];
}
