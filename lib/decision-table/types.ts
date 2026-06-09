export const HIT_POLICY_VALUES = [
  "UNIQUE",
  "FIRST",
  "UNANIMOUS",
  "COLLECT",
] as const;

export type HitPolicy = (typeof HIT_POLICY_VALUES)[number];

export interface CandidateCase {
  index: number;
  name?: string;
  decision: string;
}

export interface DecisionTableCase {
  caseName?: string;
  decision?: string;
  conditions?: {
    conditionBlock?: Array<{
      condition?: unknown;
    }>;
  };
}

export interface DecisionResult {
  decision: string | string[];
  matchedCases: CandidateCase[];
}

export type PolicyEvaluator = (
  candidates: CandidateCase[],
  defaultDecision: string,
) => DecisionResult;
