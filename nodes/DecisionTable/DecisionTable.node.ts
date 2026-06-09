import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";
import { evaluateDecisionTable } from "../../lib/decision-table/evaluate";
import {
  collectCandidateCases,
  hasAllConditionsMatched,
} from "../../lib/decision-table/match-cases";
import {
  DecisionTableCase,
  HIT_POLICY_VALUES,
  HitPolicy,
} from "../../lib/decision-table/types";
import { evaluateFilterCondition } from "../../lib/shared/evaluate-filter";
import { getTechnicalErrorMessage } from "../../lib/shared/error";
import {
  createFailedOutputItem,
  createOutputItem,
} from "../../lib/shared/output-item";

const HIT_POLICY_SET = new Set<string>(HIT_POLICY_VALUES);
const COLLECT_PORT_NAME = "decision";
const DYNAMIC_OUTPUTS_EXPRESSION: `={{${string}}}` = `={{(() => { const hitPolicy = ($parameter.options && typeof $parameter.options.hitPolicy === "string") ? $parameter.options.hitPolicy : "UNIQUE"; if (hitPolicy === "COLLECT") { return [{ type: "main", displayName: "decision" }]; } const seen = new Set(); const visible = []; const cases = ($parameter.cases && Array.isArray($parameter.cases.caseBlock)) ? $parameter.cases.caseBlock : []; for (const caseRow of cases) { const rawDecision = caseRow && typeof caseRow.decision === "string" ? caseRow.decision.trim() : ""; if (!rawDecision || seen.has(rawDecision)) { continue; } seen.add(rawDecision); visible.push(rawDecision); } const defaultDecision = typeof $parameter.defaultDecision === "string" ? $parameter.defaultDecision.trim() : ""; if (defaultDecision && !seen.has(defaultDecision)) { seen.add(defaultDecision); visible.push(defaultDecision); } return visible.map((decision) => ({ type: "main", displayName: decision })); })()}}`;

interface ICaseBlockLike {
  decision?: unknown;
}

interface IDecisionTableParametersLike {
  defaultDecision?: unknown;
  cases?: {
    caseBlock?: ICaseBlockLike[];
  };
  options?: {
    hitPolicy?: unknown;
  };
}

interface INodeOutputConfigurationLike {
  type: "main";
  displayName: string;
}

interface IEvaluatedDecisionItemResult {
  outputField: string;
  hitPolicy: HitPolicy;
  outputItem: INodeExecutionData;
}

function isHitPolicy(value: unknown): value is HitPolicy {
  return typeof value === "string" && HIT_POLICY_SET.has(value);
}

function normalizeDecision(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeNonEmptyDecision(
  value: unknown,
  label: string,
  itemIndex: number,
): string {
  const normalized = normalizeDecision(value);
  if (normalized.length === 0) {
    throw new Error(`${label} must not be empty (item ${itemIndex + 1}).`);
  }

  return normalized;
}

function resolveOutputField(ctx: IExecuteFunctions, itemIndex: number): string {
  const outputFieldRaw = ctx.getNodeParameter(
    "options.outputFieldName",
    itemIndex,
    "_decision",
  ) as string;

  return outputFieldRaw.trim() || "_decision";
}

function resolveHitPolicy(value: unknown): HitPolicy {
  if (isHitPolicy(value)) {
    return value;
  }

  return "UNIQUE";
}

function resolveVisibleDecisionPorts(
  parameters: IDecisionTableParametersLike,
): string[] {
  const seen = new Set<string>();
  const visible: string[] = [];
  const cases = parameters.cases?.caseBlock ?? [];

  for (const tableCase of cases) {
    const decision = normalizeDecision(tableCase.decision);
    if (decision.length === 0 || seen.has(decision)) {
      continue;
    }

    seen.add(decision);
    visible.push(decision);
  }

  const defaultDecision = normalizeDecision(parameters.defaultDecision);
  if (defaultDecision.length > 0 && !seen.has(defaultDecision)) {
    visible.push(defaultDecision);
  }

  return visible;
}

export function collectVisibleDecisions(
  parameters: IDecisionTableParametersLike,
): string[] {
  const hitPolicy = resolveHitPolicy(parameters.options?.hitPolicy);
  if (hitPolicy === "COLLECT") {
    return [COLLECT_PORT_NAME];
  }

  return resolveVisibleDecisionPorts(parameters);
}

export function configuredOutputs(
  parameters: IDecisionTableParametersLike,
): INodeOutputConfigurationLike[] {
  return collectVisibleDecisions(parameters).map((decision) => ({
    type: "main",
    displayName: decision,
  }));
}

function buildDecisionToOutputIndex(parameters: IDecisionTableParametersLike) {
  const mapping = new Map<string, number>();
  const visibleDecisions = resolveVisibleDecisionPorts(parameters);

  for (const [index, decision] of visibleDecisions.entries()) {
    mapping.set(decision, index);
  }

  return mapping;
}

function sanitizeConditionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeConditionValue(item));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .filter((key) => key !== "id")
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sanitizeConditionValue(source[key]);
        return acc;
      }, {});
  }

  return value;
}

function buildCaseConditionSignature(tableCase: DecisionTableCase): string {
  const conditionBlocks = tableCase.conditions?.conditionBlock ?? [];
  const signatures = conditionBlocks
    .map((conditionBlock) =>
      JSON.stringify(sanitizeConditionValue(conditionBlock.condition ?? null)),
    )
    .sort();

  return signatures.join("&&");
}

function validateUniqueCaseSignatures(
  casesData: DecisionTableCase[],
): string | null {
  const firstCaseBySignature = new Map<string, number>();

  for (let caseIndex = 0; caseIndex < casesData.length; caseIndex++) {
    const conditionBlocks =
      casesData[caseIndex].conditions?.conditionBlock ?? [];
    if (conditionBlocks.length === 0) {
      continue;
    }

    const signature = buildCaseConditionSignature(casesData[caseIndex]);
    const firstSeenIndex = firstCaseBySignature.get(signature);
    if (firstSeenIndex !== undefined) {
      return `Cases #${firstSeenIndex + 1} and #${caseIndex + 1} have identical condition sets. This is not allowed for Unique hit policy.`;
    }

    firstCaseBySignature.set(signature, caseIndex);
  }

  return null;
}

function buildPerCaseConditionMatches(
  ctx: IExecuteFunctions,
  itemIndex: number,
  casesData: DecisionTableCase[],
): boolean[][] {
  const perCaseConditionMatches: boolean[][] = [];

  for (let caseIndex = 0; caseIndex < casesData.length; caseIndex++) {
    const conditionBlocks =
      casesData[caseIndex].conditions?.conditionBlock ?? [];
    const conditionResults: boolean[] = [];

    for (
      let conditionIndex = 0;
      conditionIndex < conditionBlocks.length;
      conditionIndex++
    ) {
      const isMatch = evaluateFilterCondition(
        ctx,
        `cases.caseBlock[${caseIndex}].conditions.conditionBlock[${conditionIndex}].condition`,
        itemIndex,
      );
      conditionResults.push(isMatch);

      if (!isMatch) {
        break;
      }
    }

    if (
      conditionResults.length > 0 &&
      !hasAllConditionsMatched(conditionResults)
    ) {
      perCaseConditionMatches.push([false]);
      continue;
    }

    perCaseConditionMatches.push(conditionResults);
  }

  return perCaseConditionMatches;
}

function evaluateItem(
  ctx: IExecuteFunctions,
  itemIndex: number,
  item: INodeExecutionData,
): IEvaluatedDecisionItemResult {
  const outputField = resolveOutputField(ctx, itemIndex);
  const hitPolicy = resolveHitPolicy(
    ctx.getNodeParameter("options.hitPolicy", itemIndex, "UNIQUE"),
  );
  const defaultDecision = normalizeNonEmptyDecision(
    ctx.getNodeParameter("defaultDecision", itemIndex, "deny"),
    "Default Decision",
    itemIndex,
  );
  const includeMatchedCase = ctx.getNodeParameter(
    "options.includeMatchedCase",
    itemIndex,
    false,
  ) as boolean;
  const casesData = ctx.getNodeParameter(
    "cases.caseBlock",
    itemIndex,
    [],
  ) as DecisionTableCase[];

  for (const [caseIndex, tableCase] of casesData.entries()) {
    const normalizedDecision = normalizeDecision(tableCase.decision);
    if (normalizedDecision.length === 0) {
      throw new Error(`Case #${caseIndex + 1} Decision must not be empty.`);
    }
  }

  if (hitPolicy === "UNIQUE") {
    const duplicateMessage = validateUniqueCaseSignatures(casesData);
    if (duplicateMessage) {
      throw new Error(duplicateMessage);
    }
  }

  const perCaseConditionMatches = buildPerCaseConditionMatches(
    ctx,
    itemIndex,
    casesData,
  );
  const candidateCases = collectCandidateCases(
    casesData,
    perCaseConditionMatches,
  );
  const decisionResult = evaluateDecisionTable(
    hitPolicy,
    candidateCases,
    defaultDecision,
  );

  const matchedCase =
    includeMatchedCase &&
    hitPolicy !== "COLLECT" &&
    decisionResult.matchedCases.length > 0
      ? {
          index: decisionResult.matchedCases[0].index,
          ...(decisionResult.matchedCases[0].name
            ? { name: decisionResult.matchedCases[0].name }
            : {}),
        }
      : undefined;

  const matchedCases =
    includeMatchedCase && hitPolicy === "COLLECT"
      ? decisionResult.matchedCases.map((matched) => ({
          index: matched.index,
          ...(matched.name ? { name: matched.name } : {}),
          decision: matched.decision,
        }))
      : undefined;

  return {
    outputField,
    hitPolicy,
    outputItem: createOutputItem({
      item,
      itemIndex,
      outputFieldName: outputField,
      decision: decisionResult.decision,
      matchedCase,
      matchedCases,
    }),
  };
}

export class DecisionTable implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Decision Table",
    name: "decisionTable",
    icon: "file:decision-table.svg",
    group: ["transform"],
    version: 1,
    description:
      "Switchless decision-table routing with configurable hit policies",
    codex: {
      alias: ["Decision Table", "Switchless", "Rule Evaluator"],
    },
    subtitle: '={{$parameter["cases"]?.["caseBlock"]?.length ?? 0}} cases',
    defaults: {
      name: "Decision Table",
    },
    inputs: ["main"],
    outputs: DYNAMIC_OUTPUTS_EXPRESSION,
    properties: [
      {
        displayName: "Default Decision",
        name: "defaultDecision",
        type: "string",
        default: "deny",
        description: "Decision to use when no case matches",
      },
      {
        displayName: "Cases",
        name: "cases",
        placeholder: "Add Case",
        type: "fixedCollection",
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        options: [
          {
            name: "caseBlock",
            displayName: "Case",
            values: [
              {
                displayName: "Case Name",
                name: "caseName",
                type: "string",
                default: "",
                description: "Optional name used in debug and error messages",
              },
              {
                displayName: "Conditions",
                name: "conditions",
                placeholder: "Add Condition",
                type: "fixedCollection",
                typeOptions: {
                  multipleValues: true,
                },
                default: {},
                options: [
                  {
                    name: "conditionBlock",
                    displayName: "Condition",
                    values: [
                      {
                        displayName: "Condition",
                        name: "condition",
                        type: "filter",
                        default: {},
                        typeOptions: {
                          multipleValues: false,
                          filter: {
                            caseSensitive: true,
                            typeValidation: "strict",
                            version: 3,
                            maxConditions: 1,
                          },
                        },
                        description: "Define one condition for this case",
                      },
                    ],
                  },
                ],
                description: "All conditions in a case must match (AND)",
              },
              {
                displayName: "Decision",
                name: "decision",
                type: "string",
                default: "",
                placeholder: "approve",
                description: "Decision value returned when this case matches",
              },
            ],
          },
        ],
      },
      {
        displayName: "Options",
        name: "options",
        type: "collection",
        placeholder: "Add option",
        default: {},
        options: [
          {
            displayName: "Hit Policy",
            name: "hitPolicy",
            type: "options",
            options: [
              {
                name: "Unique",
                value: "UNIQUE",
              },
              {
                name: "First",
                value: "FIRST",
              },
              {
                name: "Unanimous",
                value: "UNANIMOUS",
              },
              {
                name: "Collect",
                value: "COLLECT",
              },
            ],
            default: "UNIQUE",
            description: "How to resolve multiple matched cases",
          },
          {
            displayName: "Output Field Name",
            name: "outputFieldName",
            type: "string",
            default: "_decision",
            description:
              "Name of the output field to store the resolved decision",
          },
          {
            displayName: "Include Matched Case",
            name: "includeMatchedCase",
            type: "boolean",
            default: false,
            description:
              'Whether to include matched case debug info as "matched_case" or "matched_cases"',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const rawNodeParameters = this.getNode()
      .parameters as IDecisionTableParametersLike;
    let outputParameters: IDecisionTableParametersLike = rawNodeParameters;

    if (items.length > 0) {
      try {
        outputParameters = {
          defaultDecision: this.getNodeParameter("defaultDecision", 0),
          cases: {
            caseBlock: this.getNodeParameter(
              "cases.caseBlock",
              0,
              [],
            ) as ICaseBlockLike[],
          },
          options: {
            hitPolicy: this.getNodeParameter("options.hitPolicy", 0, "UNIQUE"),
          },
        };
      } catch {
        outputParameters = rawNodeParameters;
      }
    }

    const outputConfigs = configuredOutputs(outputParameters);
    const outputBuckets: INodeExecutionData[][] = outputConfigs.map(() => []);
    if (outputBuckets.length === 0) {
      outputBuckets.push([]);
    }

    const outputHitPolicy = resolveHitPolicy(
      outputParameters.options?.hitPolicy,
    );
    const decisionToOutputIndex = buildDecisionToOutputIndex(outputParameters);
    const fallbackOutputIndex =
      outputHitPolicy === "COLLECT"
        ? 0
        : (decisionToOutputIndex.get(
            normalizeDecision(outputParameters.defaultDecision),
          ) ?? 0);

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const evaluatedItem = evaluateItem(this, itemIndex, items[itemIndex]);
        if (evaluatedItem.hitPolicy === "COLLECT") {
          outputBuckets[0].push(evaluatedItem.outputItem);
          continue;
        }

        const decisionValue =
          evaluatedItem.outputItem.json[evaluatedItem.outputField];
        const routedOutputIndex =
          typeof decisionValue === "string"
            ? decisionToOutputIndex.get(decisionValue)
            : undefined;
        outputBuckets[routedOutputIndex ?? fallbackOutputIndex].push(
          evaluatedItem.outputItem,
        );
      } catch (error) {
        const safeErrorMessage = getTechnicalErrorMessage(error);
        if (this.continueOnFail()) {
          let outputField = "_decision";
          let hitPolicy: HitPolicy = outputHitPolicy;
          try {
            outputField = resolveOutputField(this, itemIndex);
            hitPolicy = resolveHitPolicy(
              this.getNodeParameter("options.hitPolicy", itemIndex, "UNIQUE"),
            );
          } catch {
            // Keep defaults if parameter resolution itself fails.
          }

          const failedItem = createFailedOutputItem({
            item: items[itemIndex],
            itemIndex,
            outputFieldName: outputField,
            errorMessage: safeErrorMessage,
          });

          const failedOutputIndex =
            hitPolicy === "COLLECT" ? 0 : fallbackOutputIndex;
          outputBuckets[failedOutputIndex].push(failedItem);
        } else {
          const nodeError =
            error instanceof Error
              ? error
              : new Error("Technical error during node execution");
          throw new NodeOperationError(this.getNode(), nodeError, {
            itemIndex,
          });
        }
      }
    }

    return outputBuckets;
  }
}
