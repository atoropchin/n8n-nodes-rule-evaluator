import { CandidateCase, DecisionResult } from "../types";

export function evaluateCollectPolicy(
  candidates: CandidateCase[],
  defaultDecision: string,
): DecisionResult {
  if (candidates.length === 0) {
    return {
      decision: [defaultDecision],
      matchedCases: [],
    };
  }

  return {
    decision: candidates.map((candidate) => candidate.decision),
    matchedCases: candidates,
  };
}
