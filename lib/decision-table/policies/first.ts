import { CandidateCase, DecisionResult } from "../types";

export function evaluateFirstPolicy(
  candidates: CandidateCase[],
  defaultDecision: string,
): DecisionResult {
  if (candidates.length === 0) {
    return {
      decision: defaultDecision,
      matchedCases: [],
    };
  }

  return {
    decision: candidates[0].decision,
    matchedCases: candidates,
  };
}
