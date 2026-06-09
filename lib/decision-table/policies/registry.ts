import { evaluateCollectPolicy } from "./collect";
import { evaluateFirstPolicy } from "./first";
import { evaluateUniquePolicy } from "./unique";
import { evaluateUnanimousPolicy } from "./unanimous";
import { HitPolicy, PolicyEvaluator } from "../types";

const POLICY_REGISTRY: Record<HitPolicy, PolicyEvaluator> = {
  UNIQUE: evaluateUniquePolicy,
  FIRST: evaluateFirstPolicy,
  UNANIMOUS: evaluateUnanimousPolicy,
  COLLECT: evaluateCollectPolicy,
};

export function resolvePolicyEvaluator(hitPolicy: HitPolicy): PolicyEvaluator {
  return POLICY_REGISTRY[hitPolicy];
}
