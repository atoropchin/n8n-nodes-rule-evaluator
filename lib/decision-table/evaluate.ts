import { resolvePolicyEvaluator } from "./policies/registry";
import { CandidateCase, DecisionResult, HitPolicy } from "./types";

export function evaluateDecisionTable(
  hitPolicy: HitPolicy,
  candidates: CandidateCase[],
  defaultDecision: string,
): DecisionResult {
  const evaluator = resolvePolicyEvaluator(hitPolicy);
  return evaluator(candidates, defaultDecision);
}
