import assert from 'node:assert/strict';
import test from 'node:test';
import ruleEvaluatorModule from '../dist/nodes/RuleEvaluator/RuleEvaluator.node.js';

const { RuleEvaluator } = ruleEvaluatorModule;

function createMockContext({
	items,
	defaultDecision = 'deny',
	rulesData = [],
	includeMatchedRules = false,
	outputFieldName = '_decision',
	conditionResults = [],
	conditionErrorIndices = [],
	continueOnFail = false,
	throwOnParameter,
	customGetNodeParameter,
	requireExtractValueOnCondition = false,
}) {
	return {
		getInputData() {
			return items;
		},
		getNodeParameter(name, itemIndex, defaultValue, options) {
			if (typeof customGetNodeParameter === 'function') {
				return customGetNodeParameter(name, itemIndex, defaultValue, options);
			}

			if (throwOnParameter === name) {
				throw new Error(`Forced parameter error: ${name}`);
			}

			if (name === 'options.outputFieldName') {
				return outputFieldName;
			}
			if (name === 'rules.ruleBlock') {
				return rulesData;
			}
			if (name === 'defaultDecision') {
				return defaultDecision;
			}
			if (name === 'options.includeMatchedRules') {
				return includeMatchedRules;
			}

			const match = name.match(/^rules\.ruleBlock\[(\d+)\]\.condition$/);
			if (match) {
				if (requireExtractValueOnCondition && options?.extractValue !== true) {
					throw new Error('Expected getNodeParameter condition call with { extractValue: true }');
				}
				const idx = Number(match[1]);
				if (conditionErrorIndices.includes(idx)) {
					throw new Error(`Forced condition evaluation error at rule ${idx}`);
				}
				return conditionResults[idx] ?? false;
			}

			return defaultValue;
		},
		continueOnFail() {
			return continueOnFail;
		},
		getNode() {
			return { name: 'Rule Evaluator' };
		},
	};
}

test('chooses highest priority decision among matched rules', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 1 } }],
		defaultDecision: 'deny',
		rulesData: [{ decision: 'allow' }, { decision: 'silent' }],
		conditionResults: [true, true],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output.length, 1);
	assert.equal(output[0].json._decision, 'silent');
	assert.equal(output[0].json.id, 1);
	assert.deepEqual(output[0].pairedItem, { item: 0 });
});

test('uses default decision when no rules match', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 2 } }],
		defaultDecision: 'escalate',
		rulesData: [{ decision: 'deny' }, { decision: 'allow' }],
		conditionResults: [false, false],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'escalate');
});

test('escalates to error when rule condition evaluation throws', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 3 } }],
		defaultDecision: 'allow',
		rulesData: [{ decision: 'allow' }],
		conditionErrorIndices: [0],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'error');
	assert.equal(output[0].json.error, undefined);
});

test('continueOnFail keeps input data and sets decision to error', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 4, sender: 'ivan' }, binary: { file: { data: 'abc' } } }],
		outputFieldName: 'result',
		continueOnFail: true,
		throwOnParameter: 'defaultDecision',
	});

	const [output] = await node.execute.call(context);
	assert.equal(output.length, 1);
	assert.equal(output[0].json.id, 4);
	assert.equal(output[0].json.sender, 'ivan');
	assert.equal(output[0].json.result, 'error');
	assert.equal(output[0].json.error, 'internal_error');
	assert.deepEqual(output[0].binary, { file: { data: 'abc' } });
	assert.deepEqual(output[0].pairedItem, { item: 0 });
});

test('invalid matched rule decision escalates to error', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 5 } }],
		defaultDecision: 'allow',
		rulesData: [{ decision: 'not-a-valid-decision' }],
		conditionResults: [true],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'error');
});

test('falls back to _decision when output field name is blank', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 6 } }],
		defaultDecision: 'allow',
		rulesData: [],
		outputFieldName: '   ',
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'allow');
	assert.equal(output[0].json['   '], undefined);
});

test('invalid defaultDecision escalates to error', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 7 } }],
		defaultDecision: 'not-a-valid-decision',
		rulesData: [{ decision: 'allow' }],
		conditionResults: [true],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'error');
});

test('includeMatchedRules adds matched_rules with 1-based ruleIndex', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 8 } }],
		defaultDecision: 'deny',
		includeMatchedRules: true,
		rulesData: [{ decision: 'allow' }, { decision: 'silent' }, { decision: 'escalate' }],
		conditionResults: [true, false, true],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'escalate');
	assert.deepEqual(output[0].json.matched_rules, [
		{ ruleIndex: 1, decision: 'allow' },
		{ ruleIndex: 3, decision: 'escalate' },
	]);
});

test('returns empty output when input items are empty', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [],
	});

	const [output] = await node.execute.call(context);
	assert.deepEqual(output, []);
});

test('handles large number of rules and keeps priority resolution stable', async () => {
	const node = new RuleEvaluator();
	const rulesData = [];
	const conditionResults = [];

	for (let i = 0; i < 1000; i++) {
		rulesData.push({ decision: i % 2 === 0 ? 'allow' : 'escalate' });
		conditionResults.push(false);
	}

	// Match a few lower-priority rules and one higher-priority rule.
	conditionResults[25] = true; // allow
	conditionResults[300] = true; // escalate
	conditionResults[999] = true; // escalate

	const context = createMockContext({
		items: [{ json: { id: 9 } }],
		defaultDecision: 'deny',
		rulesData,
		conditionResults,
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'escalate');
});

test('preserves binary data on successful processing path', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 10 }, binary: { file: { data: 'xyz' } } }],
		defaultDecision: 'allow',
		rulesData: [],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'allow');
	assert.deepEqual(output[0].binary, { file: { data: 'xyz' } });
});

test('works in a simple chain of two Rule Evaluator executions', async () => {
	const nodeA = new RuleEvaluator();
	const nodeB = new RuleEvaluator();

	const contextA = createMockContext({
		items: [{ json: { id: 11 } }],
		defaultDecision: 'allow',
		rulesData: [],
		outputFieldName: '_decision_a',
	});

	const [firstOutput] = await nodeA.execute.call(contextA);
	assert.equal(firstOutput[0].json._decision_a, 'allow');

	const contextB = createMockContext({
		items: firstOutput,
		defaultDecision: 'silent',
		rulesData: [],
		outputFieldName: '_decision_b',
	});

	const [secondOutput] = await nodeB.execute.call(contextB);
	assert.equal(secondOutput[0].json._decision_a, 'allow');
	assert.equal(secondOutput[0].json._decision_b, 'silent');
	assert.deepEqual(secondOutput[0].pairedItem, { item: 0 });
});

test('continueOnFail handles non-Error throws without crashing', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 12 } }],
		continueOnFail: true,
		customGetNodeParameter(name) {
			if (name === 'defaultDecision') {
				throw 'oops';
			}
			if (name === 'options.outputFieldName') {
				return '_decision';
			}
			if (name === 'rules.ruleBlock') {
				return [];
			}
			if (name === 'options.includeMatchedRules') {
				return false;
			}
			return undefined;
		},
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'error');
	assert.equal(output[0].json.error, 'Technical error during node execution');
});

test('continueOnFail supports mixed success and failure in same batch', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 13 } }, { json: { id: 14 } }],
		continueOnFail: true,
		customGetNodeParameter(name, itemIndex, defaultValue) {
			if (name === 'options.outputFieldName') return '_decision';
			if (name === 'rules.ruleBlock') return [];
			if (name === 'options.includeMatchedRules') return false;
			if (name === 'defaultDecision') {
				if (itemIndex === 1) {
					throw new Error('Forced item-level failure');
				}
				return 'allow';
			}
			return defaultValue;
		},
	});

	const [output] = await node.execute.call(context);
	assert.equal(output.length, 2);
	assert.equal(output[0].json.id, 13);
	assert.equal(output[0].json._decision, 'allow');
	assert.equal(output[1].json.id, 14);
	assert.equal(output[1].json._decision, 'error');
	assert.equal(output[1].json.error, 'internal_error');
});

test('includeMatchedRules=false does not emit matched_rules after later escalation', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 15 } }],
		defaultDecision: 'allow',
		includeMatchedRules: false,
		rulesData: [{ decision: 'allow' }, { decision: 'bad-decision' }],
		conditionResults: [true, true],
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'error');
	assert.equal(output[0].json.matched_rules, undefined);
});

test('smoke: condition extraction uses getNodeParameter with extractValue=true', async () => {
	const node = new RuleEvaluator();
	const context = createMockContext({
		items: [{ json: { id: 16 } }],
		defaultDecision: 'deny',
		rulesData: [{ decision: 'allow' }],
		conditionResults: [true],
		requireExtractValueOnCondition: true,
	});

	const [output] = await node.execute.call(context);
	assert.equal(output[0].json._decision, 'allow');
});
