import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

type RuleDecision = 'allow' | 'escalate' | 'silent' | 'deny' | 'error';
const RULE_DECISIONS = ['allow', 'escalate', 'silent', 'deny', 'error'] as const;
const RULE_DECISIONS_SET = new Set<string>(RULE_DECISIONS);
const DECISION_PRIORITIES: Record<RuleDecision, number> = RULE_DECISIONS.reduce(
	(acc, decision, index) => {
		acc[decision] = index + 1;
		return acc;
	},
	{} as Record<RuleDecision, number>,
);
const RULE_DECISION_OPTIONS: Array<{ name: string; value: RuleDecision }> = RULE_DECISIONS.map(
	(value) => ({
		name: value.charAt(0).toUpperCase() + value.slice(1),
		value,
	}),
);

function isRuleDecision(value: unknown): value is RuleDecision {
	return typeof value === 'string' && RULE_DECISIONS_SET.has(value);
}

function getTechnicalErrorMessage(error: unknown): string {
	// Do not expose raw technical details in public output fields.
	if (error instanceof Error) {
		return 'internal_error';
	}

	return 'Technical error during node execution';
}

interface IRuleBlock {
	decision: RuleDecision;
}

interface IMatchedRuleDebugInfo {
	ruleIndex: number;
	decision: RuleDecision;
}

export class RuleEvaluator implements INodeType {
	/**
	 * Resolves and normalizes the configured output field name for a given item.
	 * Falls back to `_decision` when the configured value is blank.
	 */
	private resolveOutputField(this: IExecuteFunctions, itemIndex: number): string {
		const outputFieldRaw = this.getNodeParameter(
			'options.outputFieldName',
			itemIndex,
			'_decision',
		) as string;
		return outputFieldRaw.trim() || '_decision';
	}

	/**
	 * Builds a single output item while preserving input lineage and binary payload.
	 * Optionally includes matched-rule debug metadata.
	 */
	private createOutputItem(
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
			// Keep explicit item lineage for n8n item-linking and debugging.
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

	/**
	 * Evaluates all configured business rules for one input item and computes the final decision.
	 * Caller is responsible for handling unexpected errors thrown by parameter resolution.
	 */
	private evaluateItem(this: IExecuteFunctions, itemIndex: number, item: INodeExecutionData) {
		const resolveOutputField = RuleEvaluator.prototype.resolveOutputField.bind(this);
		const createOutputItem = RuleEvaluator.prototype.createOutputItem.bind(this);
		const outputField = resolveOutputField(itemIndex);
		const rulesData = this.getNodeParameter('rules.ruleBlock', itemIndex, []) as IRuleBlock[];
		const defaultDecision = this.getNodeParameter('defaultDecision', itemIndex) as RuleDecision;
		const includeMatchedRules = this.getNodeParameter(
			'options.includeMatchedRules',
			itemIndex,
			false,
		) as boolean;

		let highestPriority = 0;
		let finalDecision: RuleDecision | '' = '';
		const matchedRules: IMatchedRuleDebugInfo[] = [];

		// Treat a malformed default decision as a system-side escalation to "error".
		if (!isRuleDecision(defaultDecision)) {
			return createOutputItem(
				item,
				itemIndex,
				outputField,
				'error',
				includeMatchedRules,
				matchedRules,
			);
		}

		for (const [ruleIndex, rule] of rulesData.entries()) {
			let isMatch: boolean;
			try {
				isMatch = this.getNodeParameter(
					`rules.ruleBlock[${ruleIndex}].condition`,
					itemIndex,
					false,
					{ extractValue: true },
				) as boolean;
			} catch {
				// Any filter-evaluation failure escalates the final decision to "error"
				finalDecision = 'error';
				break;
			}

			if (isMatch) {
				if (!isRuleDecision(rule.decision)) {
					finalDecision = 'error';
					break;
				}

				if (includeMatchedRules) {
					matchedRules.push({
						ruleIndex: ruleIndex + 1,
						decision: rule.decision,
					});
				}

				// For matched rules, pick the strongest decision by configured priority.
				const rulePriority = DECISION_PRIORITIES[rule.decision];
				if (rulePriority > highestPriority) {
					highestPriority = rulePriority;
					finalDecision = rule.decision;
				}
			}
		}

		// If no rule matched, use the configured default decision.
		if (!finalDecision) {
			finalDecision = defaultDecision;
		}

		return createOutputItem(
			item,
			itemIndex,
			outputField,
			finalDecision,
			includeMatchedRules,
			matchedRules,
		);
	}

	description: INodeTypeDescription = {
		displayName: 'Rule Evaluator',
		name: 'ruleEvaluator',
		icon: 'file:rule-evaluator.svg',
		group: ['transform'],
		version: 1,
		description: 'Evaluates business rules and assigns a decision based on priorities',
		subtitle: '={{$parameter["rules"]["ruleBlock"]?.length ?? 0}} rules',
		defaults: {
			name: 'Rule Evaluator',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Default Decision',
				name: 'defaultDecision',
				type: 'options',
				options: RULE_DECISION_OPTIONS,
				default: 'deny',
				description: 'Whether to use this decision if no rules above match',
			},
			{
				displayName: 'Business Rules',
				name: 'rules',
				placeholder: 'Add Rule',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'ruleBlock',
						displayName: 'Rule',
						values: [
							{
								displayName: 'Rule',
								name: 'condition',
								type: 'filter',
								default: {},
								typeOptions: {
									multipleValues: false,
									filter: {
										caseSensitive: true,
										typeValidation: 'strict',
										version: 3,
										maxConditions: 1,
									},
								},
								description: 'Define one condition for this rule',
							},
							{
								displayName: 'Decision',
								name: 'decision',
								type: 'options',
								options: RULE_DECISION_OPTIONS,
								default: 'allow',
								description: 'The decision if this rule matches',
							},
						],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Output Field Name',
						name: 'outputFieldName',
						type: 'string',
						default: '_decision',
						description: 'Name of the output field to store the final decision',
					},
					{
						displayName: 'Include Matched Rules',
						name: 'includeMatchedRules',
						type: 'boolean',
						default: false,
						description: 'Whether to include matched rules in output as "matched_rules"',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resolveOutputField = RuleEvaluator.prototype.resolveOutputField.bind(this);
		const evaluateItem = RuleEvaluator.prototype.evaluateItem.bind(this);

		for (let i = 0; i < items.length; i++) {
			try {
				returnData.push(evaluateItem(i, items[i]));
			} catch (error) {
				const safeErrorMessage = getTechnicalErrorMessage(error);
				// For unexpected failures, keep continueOnFail behavior item-scoped.
				if (this.continueOnFail()) {
					let outputField = '_decision';
					try {
						outputField = resolveOutputField(i);
					} catch {
						// Fall back to the default field if output-field parameter resolution fails
					}

					const failedItem: INodeExecutionData = {
						json: {
							...items[i].json,
							[outputField]: 'error',
							error: safeErrorMessage,
						},
						// Preserve lineage even for failed items.
						pairedItem: {
							item: i,
						},
					};
					if (items[i].binary !== undefined) {
						failedItem.binary = items[i].binary;
					}
					returnData.push(failedItem);
				} else {
					const nodeError =
						error instanceof Error ? error : new Error('Technical error during node execution');
					throw new NodeOperationError(this.getNode(), nodeError, { itemIndex: i });
				}
			}
		}

		return [returnData];
	}
}
