import { CandidateCase, DecisionResult } from "../types";

export function evaluateUnanimousPolicy(
  candidates: CandidateCase[],
  defaultDecision: string,
): DecisionResult {
  if (candidates.length === 0) {
    return {
      decision: defaultDecision,
      matchedCases: [],
    };
  }

  const firstDecision = candidates[0].decision;
  const conflictingCases = candidates.filter(
    (candidate) => candidate.decision !== firstDecision,
  );

  if (conflictingCases.length > 0) {
    const details = candidates
      .map((candidate) =>
        candidate.name
          ? `#${candidate.index} (${candidate.name})="${candidate.decision}"`
          : `#${candidate.index}="${candidate.decision}"`,
      )
      .join(", ");

    throw new Error(
      `Hit Policy Unanimous conflict: matched cases do not agree on one decision (${details}).`,
    );
  }

  return {
    decision: firstDecision,
    matchedCases: candidates,
  };
}
