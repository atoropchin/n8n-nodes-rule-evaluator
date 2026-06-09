import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";

const DECISION_VALUES = [
  "allow",
  "escalate",
  "silent",
  "deny",
  "error",
] as const;
type RuleDecision = (typeof DECISION_VALUES)[number];
const OUTPUTS_ORDER_JSON = JSON.stringify(DECISION_VALUES);
const DYNAMIC_OUTPUTS_EXPRESSION: `={{${string}}}` = `={{(() => { const ordered = ${OUTPUTS_ORDER_JSON}; const seen = new Set(); const rules = ($parameter.rules && $parameter.rules.ruleBlock) ? $parameter.rules.ruleBlock : []; for (const rule of rules) { const decision = rule?.decision; if (typeof decision === "string" && ordered.includes(decision)) { seen.add(decision); } } const defaultDecision = $parameter.defaultDecision; if (typeof defaultDecision === "string" && ordered.includes(defaultDecision)) { seen.add(defaultDecision); } return ordered.filter((decision) => seen.has(decision)).map((decision) => ({ type: "main", displayName: decision.charAt(0).toUpperCase() + decision.slice(1) })); })()}}`;

interface IRuleBlockLike {
  decision?: unknown;
}

interface IBusinessRulesParametersLike {
  defaultDecision?: unknown;
  rules?: {
    ruleBlock?: IRuleBlockLike[];
  };
}

interface INodeOutputConfigurationLike {
  type: "main";
  displayName: string;
}

const RULE_DECISION_SET = new Set<string>(DECISION_VALUES);

function isRuleDecision(value: unknown): value is RuleDecision {
  return typeof value === "string" && RULE_DECISION_SET.has(value);
}

function capitalizeDecision(decision: RuleDecision): string {
  return decision.charAt(0).toUpperCase() + decision.slice(1);
}

export function collectVisibleDecisions(
  parameters: IBusinessRulesParametersLike,
): RuleDecision[] {
  const seen = new Set<RuleDecision>();
  const rules = parameters.rules?.ruleBlock ?? [];
  for (const rule of rules) {
    if (isRuleDecision(rule.decision)) {
      seen.add(rule.decision);
    }
  }

  if (isRuleDecision(parameters.defaultDecision)) {
    seen.add(parameters.defaultDecision);
  }

  return DECISION_VALUES.filter((decision) => seen.has(decision));
}

export function configuredOutputs(
  parameters: IBusinessRulesParametersLike,
): INodeOutputConfigurationLike[] {
  return collectVisibleDecisions(parameters).map((decision) => ({
    type: "main",
    displayName: capitalizeDecision(decision),
  }));
}

function buildDecisionToOutputIndex(
  parameters: IBusinessRulesParametersLike,
): Map<RuleDecision, number> {
  const mapping = new Map<RuleDecision, number>();
  const visibleDecisions = collectVisibleDecisions(parameters);

  for (const [index, decision] of visibleDecisions.entries()) {
    mapping.set(decision, index);
  }

  return mapping;
}

const RULE_DECISION_OPTIONS: Array<{ name: string; value: RuleDecision }> =
  DECISION_VALUES.map((value) => ({
    name: value.charAt(0).toUpperCase() + value.slice(1),
    value,
  }));

const DECISION_PRIORITIES: Record<RuleDecision, number> =
  DECISION_VALUES.reduce(
    (acc, decision, index) => {
      acc[decision] = index + 1;
      return acc;
    },
    {} as Record<RuleDecision, number>,
  );

interface IRuleBlock {
  decision: RuleDecision;
}

interface IMatchedRuleDebugInfo {
  ruleIndex: number;
  decision: RuleDecision;
}

interface IEvaluatedItemResult {
  outputField: string;
  outputItem: INodeExecutionData;
}

function getTechnicalErrorMessage(error: unknown): string {
  // Intentional contract:
  // - Error instances are normalized to a stable machine value (`internal_error`).
  // - Non-Error throws keep a generic human-readable fallback message.
  // Do not unify these branches unless the public error contract is revised.
  if (error instanceof Error) {
    return "internal_error";
  }

  return "Technical error during node execution";
}

function resolveOutputField(ctx: IExecuteFunctions, itemIndex: number): string {
  const outputFieldRaw = ctx.getNodeParameter(
    "options.outputFieldName",
    itemIndex,
    "_decision",
  ) as string;

  return outputFieldRaw.trim() || "_decision";
}

function createOutputItem(
  item: INodeExecutionData,
  itemIndex: number,
  outputField: string,
  decision: RuleDecision,
  includeMatchedRules: boolean,
  matchedRules: IMatchedRuleDebugInfo[],
): INodeExecutionData {
  const newItem: INodeExecutionData = {
    json: {
      ...item.json,
      [outputField]: decision,
    },
    pairedItem: {
      item: itemIndex,
    },
  };

  if (includeMatchedRules) {
    newItem.json.matched_rules = matchedRules;
  }

  if (item.binary !== undefined) {
    newItem.binary = item.binary;
  }

  return newItem;
}

function evaluateItem(
  ctx: IExecuteFunctions,
  itemIndex: number,
  item: INodeExecutionData,
): IEvaluatedItemResult {
  const outputField = resolveOutputField(ctx, itemIndex);
  const rulesData = ctx.getNodeParameter(
    "rules.ruleBlock",
    itemIndex,
    [],
  ) as IRuleBlock[];
  const defaultDecision = ctx.getNodeParameter(
    "defaultDecision",
    itemIndex,
  ) as RuleDecision;
  const includeMatchedRules = ctx.getNodeParameter(
    "options.includeMatchedRules",
    itemIndex,
    false,
  ) as boolean;

  let highestPriority = 0;
  let finalDecision: RuleDecision | null = null;
  const matchedRules: IMatchedRuleDebugInfo[] = [];

  if (!isRuleDecision(defaultDecision)) {
    return {
      outputField,
      outputItem: createOutputItem(
        item,
        itemIndex,
        outputField,
        "error",
        includeMatchedRules,
        matchedRules,
      ),
    };
  }

  for (const [ruleIndex, rule] of rulesData.entries()) {
    let isMatch: boolean;
    try {
      isMatch = ctx.getNodeParameter(
        `rules.ruleBlock[${ruleIndex}].condition`,
        itemIndex,
        false,
        { extractValue: true },
      ) as boolean;
    } catch {
      // Do not leak filter-evaluation details into item output.
      finalDecision = "error";
      break;
    }

    if (!isMatch) {
      continue;
    }

    if (!isRuleDecision(rule.decision)) {
      finalDecision = "error";
      break;
    }

    if (includeMatchedRules) {
      matchedRules.push({
        ruleIndex: ruleIndex + 1,
        decision: rule.decision,
      });
    }

    const rulePriority = DECISION_PRIORITIES[rule.decision];
    if (rulePriority > highestPriority) {
      highestPriority = rulePriority;
      finalDecision = rule.decision;
    }
  }

  if (finalDecision === null) {
    finalDecision = defaultDecision;
  }

  return {
    outputField,
    outputItem: createOutputItem(
      item,
      itemIndex,
      outputField,
      finalDecision,
      includeMatchedRules,
      matchedRules,
    ),
  };
}

export class BusinessRules implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Business Rules",
    name: "businessRules",
    icon: "file:businessRules.svg",
    group: ["transform"],
    version: 1,
    description:
      "Switchless business-rule routing with dynamic decision outputs",
    codex: {
      alias: ["Business Rules", "Policy Rules", "Switchless"],
    },
    subtitle: '={{$parameter["rules"]?.["ruleBlock"]?.length ?? 0}} rules',
    defaults: {
      name: "Business Rules",
    },
    inputs: ["main"],
    // Keep this n8n expression semantically aligned with collectVisibleDecisions().
    outputs: DYNAMIC_OUTPUTS_EXPRESSION,
    properties: [
      {
        displayName: "Default Decision",
        name: "defaultDecision",
        type: "options",
        options: RULE_DECISION_OPTIONS,
        default: "deny",
        noDataExpression: true,
        description: "Whether to use this decision if no rules above match",
      },
      {
        displayName: "Business Rules",
        name: "rules",
        placeholder: "Add Rule",
        type: "fixedCollection",
        typeOptions: {
          multipleValues: true,
        },
        default: {},
        options: [
          {
            name: "ruleBlock",
            displayName: "Rule",
            values: [
              {
                displayName: "Rule",
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
                description: "Define one condition for this rule",
              },
              {
                displayName: "Decision",
                name: "decision",
                type: "options",
                options: RULE_DECISION_OPTIONS,
                default: "allow",
                noDataExpression: true,
                description: "The decision if this rule matches",
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
            displayName: "Output Field Name",
            name: "outputFieldName",
            type: "string",
            default: "_decision",
            description: "Name of the output field to store the final decision",
          },
          {
            displayName: "Include Matched Rules",
            name: "includeMatchedRules",
            type: "boolean",
            default: false,
            description:
              'Whether to include matched rules in output as "matched_rules"',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const rawNodeParameters = this.getNode()
      .parameters as IBusinessRulesParametersLike;
    let outputParameters: IBusinessRulesParametersLike = rawNodeParameters;

    // Build output mapping from resolved parameters when possible to reduce
    // mismatches between configured ports and runtime-evaluated decisions.
    if (items.length > 0) {
      try {
        outputParameters = {
          defaultDecision: this.getNodeParameter("defaultDecision", 0),
          rules: {
            ruleBlock: this.getNodeParameter(
              "rules.ruleBlock",
              0,
              [],
            ) as IRuleBlockLike[],
          },
        };
      } catch {
        outputParameters = rawNodeParameters;
      }
    }

    const decisionToOutputIndex = buildDecisionToOutputIndex(outputParameters);
    const visibleDecisions = collectVisibleDecisions(outputParameters);
    const outputBuckets: INodeExecutionData[][] = visibleDecisions.map(
      () => [],
    );
    const defaultDecision = isRuleDecision(outputParameters.defaultDecision)
      ? outputParameters.defaultDecision
      : "deny";

    if (outputBuckets.length === 0) {
      outputBuckets.push([]);
    }

    const fallbackOutputIndex = isRuleDecision(defaultDecision)
      ? (decisionToOutputIndex.get(defaultDecision) ?? 0)
      : 0;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const evaluatedItem = evaluateItem(this, itemIndex, items[itemIndex]);
        const outputField = evaluatedItem.outputField;
        const outputItem = evaluatedItem.outputItem;
        const evaluatedDecision = outputItem.json[outputField];
        const outputIndex = isRuleDecision(evaluatedDecision)
          ? decisionToOutputIndex.get(evaluatedDecision)
          : undefined;

        outputBuckets[outputIndex ?? fallbackOutputIndex].push(outputItem);
      } catch (error) {
        const safeErrorMessage = getTechnicalErrorMessage(error);
        if (this.continueOnFail()) {
          let outputField = "_decision";
          try {
            outputField = resolveOutputField(this, itemIndex);
          } catch {
            // Fall back to `_decision` when output-field parameter resolution fails.
          }

          const failedItem: INodeExecutionData = {
            json: {
              ...items[itemIndex].json,
              [outputField]: "error",
              error: safeErrorMessage,
            },
            pairedItem: {
              item: itemIndex,
            },
          };

          if (items[itemIndex].binary !== undefined) {
            failedItem.binary = items[itemIndex].binary;
          }

          const errorOutputIndex = decisionToOutputIndex.get("error");
          outputBuckets[errorOutputIndex ?? fallbackOutputIndex].push(
            failedItem,
          );
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
