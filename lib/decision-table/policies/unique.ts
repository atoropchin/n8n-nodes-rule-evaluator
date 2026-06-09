import { CandidateCase, DecisionResult } from "../types";

export function evaluateUniquePolicy(
  candidates: CandidateCase[],
  defaultDecision: string,
): DecisionResult {
  if (candidates.length === 0) {
    return {
      decision: defaultDecision,
      matchedCases: [],
    };
  }

  if (candidates.length > 1) {
    const details = candidates
      .map((candidate) =>
        candidate.name
          ? `#${candidate.index} (${candidate.name})`
          : `#${candidate.index}`,
      )
      .join(", ");
    throw new Error(
      `Hit Policy Unique requires a single matched case, but ${candidates.length} matched: ${details}.`,
    );
  }

  return {
    decision: candidates[0].decision,
    matchedCases: candidates,
  };
}
