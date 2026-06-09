import { CandidateCase, DecisionTableCase } from "./types";

function normalizeDecision(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeCaseName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hasAllConditionsMatched(results: boolean[]): boolean {
  if (results.length === 0) {
    return false;
  }

  return results.every((result) => result);
}

export function collectCandidateCases(
  casesData: DecisionTableCase[],
  perCaseConditionMatches: boolean[][],
): CandidateCase[] {
  const candidates: CandidateCase[] = [];

  for (const [caseIndex, tableCase] of casesData.entries()) {
    const allConditionsMatched = hasAllConditionsMatched(
      perCaseConditionMatches[caseIndex] ?? [],
    );
    if (!allConditionsMatched) {
      continue;
    }

    const decision = normalizeDecision(tableCase.decision);
    if (decision.length === 0) {
      continue;
    }

    candidates.push({
      index: caseIndex + 1,
      name: normalizeCaseName(tableCase.caseName),
      decision,
    });
  }

  return candidates;
}
