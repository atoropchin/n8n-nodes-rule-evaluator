import assert from "node:assert/strict";
import test from "node:test";

import businessRulesModule from "../dist/nodes/BusinessRules/BusinessRules.node.js";
import ruleEvaluatorModule from "../dist/nodes/RuleEvaluator/RuleEvaluator.node.js";
import { PARITY_VECTORS } from "./rule-parity-vectors.mjs";

const { BusinessRules, configuredOutputs, collectVisibleDecisions } =
  businessRulesModule;
const { RuleEvaluator } = ruleEvaluatorModule;

const OUTPUT_VECTORS = [
  {
    name: "allow rule plus default deny",
    parameters: {
      defaultDecision: "deny",
      rules: { ruleBlock: [{ decision: "allow" }] },
    },
    expected: [
      { type: "main", displayName: "Allow" },
      { type: "main", displayName: "Deny" },
    ],
  },
  {
    name: "default only without rules",
    parameters: {
      defaultDecision: "deny",
      rules: { ruleBlock: [] },
    },
    expected: [{ type: "main", displayName: "Deny" }],
  },
  {
    name: "full priority ladder from mixed rules and default",
    parameters: {
      defaultDecision: "error",
      rules: {
        ruleBlock: [
          { decision: "deny" },
          { decision: "allow" },
          { decision: "escalate" },
        ],
      },
    },
    expected: [
      { type: "main", displayName: "Allow" },
      { type: "main", displayName: "Escalate" },
      { type: "main", displayName: "Deny" },
      { type: "main", displayName: "Error" },
    ],
  },
  {
    name: "default inserted in deterministic order",
    parameters: {
      defaultDecision: "deny",
      rules: {
        ruleBlock: [{ decision: "error" }, { decision: "allow" }],
      },
    },
    expected: [
      { type: "main", displayName: "Allow" },
      { type: "main", displayName: "Deny" },
      { type: "main", displayName: "Error" },
    ],
  },
  {
    name: "deduplicated used decisions",
    parameters: {
      defaultDecision: "deny",
      rules: {
        ruleBlock: [
          { decision: "silent" },
          { decision: "allow" },
          { decision: "allow" },
        ],
      },
    },
    expected: [
      { type: "main", displayName: "Allow" },
      { type: "main", displayName: "Silent" },
      { type: "main", displayName: "Deny" },
    ],
  },
  {
    name: "hides error output when not configured",
    parameters: {
      defaultDecision: "allow",
      rules: { ruleBlock: [{ decision: "deny" }] },
    },
    expected: [
      { type: "main", displayName: "Allow" },
      { type: "main", displayName: "Deny" },
    ],
  },
];

const COLLECT_VISIBLE_VECTORS = [
  {
    name: "deduplicates and orders decisions",
    parameters: {
      defaultDecision: "error",
      rules: {
        ruleBlock: [
          { decision: "allow" },
          { decision: "error" },
          { decision: "escalate" },
        ],
      },
    },
    expected: ["allow", "escalate", "error"],
  },
  {
    name: "does not duplicate default already in rules",
    parameters: {
      defaultDecision: "error",
      rules: {
        ruleBlock: [{ decision: "error" }, { decision: "allow" }],
      },
    },
    expected: ["allow", "error"],
  },
];

const EXPR_TS_PARITY_VECTORS = [
  {
    defaultDecision: "deny",
    rules: { ruleBlock: [] },
  },
  {
    defaultDecision: "error",
    rules: { ruleBlock: [{ decision: "allow" }, { decision: "deny" }] },
  },
  {
    defaultDecision: "allow",
    rules: { ruleBlock: [{ decision: "allow" }, { decision: "silent" }] },
  },
  {
    defaultDecision: "silent",
    rules: {
      ruleBlock: [{ decision: "custom" }, {}, { decision: "escalate" }],
    },
  },
  {
    defaultDecision: "custom",
    rules: { ruleBlock: [{ decision: "deny" }] },
  },
];

function createMockContext({
  nodeName = "Business Rules",
  items,
  defaultDecision = "deny",
  rulesData = [],
  includeMatchedRules = false,
  outputFieldName = "_decision",
  conditionResults = [],
  conditionErrorIndices = [],
  continueOnFail = false,
  throwOnParameter,
  customGetNodeParameter,
  requireExtractValueOnCondition = false,
}) {
  const nodeParameters = {
    defaultDecision,
    rules: {
      ruleBlock: rulesData,
    },
  };

  return {
    getInputData() {
      return items;
    },
    getNodeParameter(name, itemIndex, defaultValue, options) {
      if (typeof customGetNodeParameter === "function") {
        return customGetNodeParameter(name, itemIndex, defaultValue, options);
      }

      if (throwOnParameter === name) {
        throw new Error(`Forced parameter error: ${name}`);
      }

      if (name === "options.outputFieldName") {
        return outputFieldName;
      }
      if (name === "rules.ruleBlock") {
        return rulesData;
      }
      if (name === "defaultDecision") {
        return defaultDecision;
      }
      if (name === "options.includeMatchedRules") {
        return includeMatchedRules;
      }

      const match = name.match(/^rules\.ruleBlock\[(\d+)\]\.condition$/);
      if (match) {
        if (requireExtractValueOnCondition && options?.extractValue !== true) {
          throw new Error(
            "Expected condition call with { extractValue: true }",
          );
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
      return {
        name: nodeName,
        parameters: nodeParameters,
      };
    },
  };
}

function flattenBuckets(buckets) {
  return buckets.flat();
}

function mapByInputIndex(items) {
  const mapping = new Map();
  for (const item of items) {
    mapping.set(item.pairedItem?.item, item);
  }
  return mapping;
}

function evaluateNodeExpression(expression, parameters) {
  assert.equal(typeof expression, "string");
  const match = expression.match(/=\{\{([\s\S]*)\}\}/);
  assert.ok(match, `Expected n8n expression format, got: ${expression}`);
  const expressionBody = match[1];
  const evaluator = new Function("$parameter", `return (${expressionBody});`);
  return evaluator(parameters);
}

for (const vector of OUTPUT_VECTORS) {
  test(`output configuration: ${vector.name}`, () => {
    const node = new BusinessRules();
    const outputsExpression = node.description.outputs;
    const expressionOutputs = evaluateNodeExpression(
      outputsExpression,
      vector.parameters,
    );
    const tsOutputs = configuredOutputs(vector.parameters);

    assert.deepEqual(expressionOutputs, vector.expected);
    assert.deepEqual(tsOutputs, vector.expected);
  });
}

test("output order is stable regardless of rule reorder", () => {
  const node = new BusinessRules();
  const outputsExpression = node.description.outputs;
  const expected = [
    { type: "main", displayName: "Allow" },
    { type: "main", displayName: "Deny" },
    { type: "main", displayName: "Error" },
  ];

  for (const ruleBlock of [
    [{ decision: "allow" }, { decision: "error" }],
    [{ decision: "error" }, { decision: "allow" }],
  ]) {
    const resolvedOutputs = evaluateNodeExpression(outputsExpression, {
      defaultDecision: "deny",
      rules: { ruleBlock },
    });
    assert.deepEqual(resolvedOutputs, expected);
  }
});

test("description.outputs expression stays in parity with configuredOutputs", () => {
  const node = new BusinessRules();
  const outputsExpression = node.description.outputs;

  for (const parameters of EXPR_TS_PARITY_VECTORS) {
    const expressionOutputs = evaluateNodeExpression(
      outputsExpression,
      parameters,
    );
    const tsOutputs = configuredOutputs(parameters);
    assert.deepEqual(expressionOutputs, tsOutputs);
  }
});

for (const vector of COLLECT_VISIBLE_VECTORS) {
  test(`collectVisibleDecisions: ${vector.name}`, () => {
    const visibleDecisions = collectVisibleDecisions(vector.parameters);
    assert.deepEqual(visibleDecisions, vector.expected);
  });
}

test("routes mixed decisions to dedicated output buckets", async () => {
  const node = new BusinessRules();
  const context = createMockContext({
    items: [{ json: { id: 1 } }, { json: { id: 2 } }],
    defaultDecision: "deny",
    rulesData: [{ decision: "allow" }, { decision: "deny" }],
    conditionResults: [true, false],
    customGetNodeParameter(name, itemIndex, defaultValue, options) {
      if (name === "rules.ruleBlock")
        return [{ decision: "allow" }, { decision: "deny" }];
      if (name === "defaultDecision") return "deny";
      if (name === "options.outputFieldName") return "_decision";
      if (name === "options.includeMatchedRules") return false;

      const match = name.match(/^rules\.ruleBlock\[(\d+)\]\.condition$/);
      if (match) {
        const ruleIndex = Number(match[1]);
        if (options?.extractValue !== true) {
          throw new Error("Expected extractValue");
        }
        if (itemIndex === 0) return ruleIndex === 0;
        return false;
      }
      return defaultValue;
    },
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].length, 1);
  assert.equal(buckets[0][0].json._decision, "allow");
  assert.equal(buckets[1].length, 1);
  assert.equal(buckets[1][0].json._decision, "deny");
});

test("fallback routes hidden error decision to default bucket without mutating decision", async () => {
  const node = new BusinessRules();
  const context = createMockContext({
    items: [{ json: { id: 3 } }],
    defaultDecision: "allow",
    rulesData: [{ decision: "allow" }],
    conditionErrorIndices: [0],
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].length, 1);
  assert.equal(buckets[0][0].json._decision, "error");
});

for (const vector of [
  {
    name: "fallback when error output hidden",
    rulesData: [],
    expectedBucketCount: 1,
    assertBuckets(buckets) {
      assert.equal(buckets[0].length, 1);
      assert.equal(buckets[0][0].json._decision, "error");
      assert.equal(buckets[0][0].json.error, "internal_error");
    },
  },
  {
    name: "error bucket when error output visible",
    rulesData: [{ decision: "error" }],
    expectedBucketCount: 2,
    assertBuckets(buckets) {
      assert.equal(buckets[0].length, 0);
      assert.equal(buckets[1].length, 1);
      assert.equal(buckets[1][0].json._decision, "error");
      assert.equal(buckets[1][0].json.error, "internal_error");
    },
  },
]) {
  test(`continueOnFail routes failed item: ${vector.name}`, async () => {
    const node = new BusinessRules();
    const context = createMockContext({
      items: [{ json: { id: 4 } }],
      defaultDecision: "allow",
      rulesData: vector.rulesData,
      continueOnFail: true,
      throwOnParameter: "defaultDecision",
    });

    const buckets = await node.execute.call(context);
    assert.equal(buckets.length, vector.expectedBucketCount);
    vector.assertBuckets(buckets);
  });
}

test("routes by custom outputFieldName decision value", async () => {
  const node = new BusinessRules();
  const context = createMockContext({
    items: [{ json: { id: 42 } }],
    defaultDecision: "deny",
    rulesData: [{ decision: "allow" }],
    outputFieldName: "decision_result",
    customGetNodeParameter(name, itemIndex, defaultValue, options) {
      if (name === "options.outputFieldName") return "decision_result";
      if (name === "rules.ruleBlock") return [{ decision: "allow" }];
      if (name === "defaultDecision") return "deny";
      if (name === "options.includeMatchedRules") return false;
      const match = name.match(/^rules\.ruleBlock\[(\d+)\]\.condition$/);
      if (match) {
        if (options?.extractValue !== true) {
          throw new Error("Expected extractValue");
        }
        return Number(match[1]) === 0;
      }
      return defaultValue;
    },
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].length, 1);
  assert.equal(buckets[0][0].json.decision_result, "allow");
  assert.equal(buckets[0][0].json._decision, undefined);
  assert.equal(buckets[1].length, 0);
});

test("returns one empty bucket per visible output for empty input", async () => {
  const node = new BusinessRules();
  const context = createMockContext({
    items: [],
    defaultDecision: "deny",
    rulesData: [{ decision: "allow" }],
  });

  const buckets = await node.execute.call(context);
  assert.deepEqual(buckets, [[], []]);
});

test("preserves binary and pairedItem metadata", async () => {
  const node = new BusinessRules();
  const context = createMockContext({
    items: [{ json: { id: 5 }, binary: { file: { data: "xyz" } } }],
    defaultDecision: "allow",
    rulesData: [],
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].length, 1);
  assert.deepEqual(buckets[0][0].binary, { file: { data: "xyz" } });
  assert.deepEqual(buckets[0][0].pairedItem, { item: 0 });
});

for (const vector of PARITY_VECTORS) {
  test(`parity RE vs BR: ${vector.name}`, async () => {
    const reNode = new RuleEvaluator();
    const brNode = new BusinessRules();

    const contextConfig = {
      items: [{ json: { id: vector.name } }],
      defaultDecision: vector.defaultDecision,
      rulesData: vector.rulesData,
      conditionResults: vector.conditionResults,
      conditionErrorIndices: vector.conditionErrorIndices ?? [],
    };

    const reContext = createMockContext({
      ...contextConfig,
      nodeName: "Rule Enricher",
    });
    const brContext = createMockContext({
      ...contextConfig,
      nodeName: "Business Rules",
    });

    const [reOutput] = await reNode.execute.call(reContext);
    const brBuckets = await brNode.execute.call(brContext);
    const brOutput = flattenBuckets(brBuckets);

    assert.equal(reOutput.length, 1);
    assert.equal(brOutput.length, 1);
    assert.equal(reOutput[0].json._decision, vector.expectedDecision);
    assert.equal(brOutput[0].json._decision, vector.expectedDecision);
  });
}

test("parity keeps decision per item for mixed batch", async () => {
  const reNode = new RuleEvaluator();
  const brNode = new BusinessRules();

  const customGetNodeParameter = (name, itemIndex, defaultValue, options) => {
    if (name === "options.outputFieldName") return "_decision";
    if (name === "rules.ruleBlock")
      return [{ decision: "allow" }, { decision: "deny" }];
    if (name === "defaultDecision") return "escalate";
    if (name === "options.includeMatchedRules") return false;
    const match = name.match(/^rules\.ruleBlock\[(\d+)\]\.condition$/);
    if (match) {
      if (options?.extractValue !== true) {
        throw new Error("Expected extractValue");
      }
      const ruleIndex = Number(match[1]);
      if (itemIndex === 0) return ruleIndex === 0;
      if (itemIndex === 1) return ruleIndex === 1;
      return false;
    }
    return defaultValue;
  };

  const items = [
    { json: { id: "a" } },
    { json: { id: "b" } },
    { json: { id: "c" } },
  ];
  const reContext = createMockContext({
    items,
    customGetNodeParameter,
    nodeName: "Rule Enricher",
  });
  const brContext = createMockContext({
    items,
    customGetNodeParameter,
    nodeName: "Business Rules",
  });

  const [reOutput] = await reNode.execute.call(reContext);
  const brBuckets = await brNode.execute.call(brContext);
  const brOutput = flattenBuckets(brBuckets);

  const reByIndex = mapByInputIndex(reOutput);
  const brByIndex = mapByInputIndex(brOutput);

  assert.deepEqual(
    Array.from(reByIndex.keys()).sort(),
    Array.from(brByIndex.keys()).sort(),
  );

  for (const [index, reItem] of reByIndex.entries()) {
    assert.equal(brByIndex.get(index).json._decision, reItem.json._decision);
  }
});

test("business rules disables expressions for decision options", () => {
  const node = new BusinessRules();
  const defaultDecisionProperty = node.description.properties.find(
    (property) => property.name === "defaultDecision",
  );
  assert.equal(defaultDecisionProperty?.noDataExpression, true);

  const rulesProperty = node.description.properties.find(
    (property) => property.name === "rules",
  );
  const ruleDecisionProperty = rulesProperty?.options?.[0]?.values?.find(
    (property) => property.name === "decision",
  );
  assert.equal(ruleDecisionProperty?.noDataExpression, true);
});

test("processes 1000 items without failure", async () => {
  const node = new BusinessRules();
  const items = Array.from({ length: 1000 }, (_, index) => ({
    json: { id: index },
  }));
  const context = createMockContext({
    items,
    defaultDecision: "deny",
    rulesData: [{ decision: "allow" }],
    conditionResults: [true],
  });

  const startedAt = Date.now();
  const buckets = await node.execute.call(context);
  const elapsedMs = Date.now() - startedAt;

  const routedCount = buckets.reduce(
    (total, bucket) => total + bucket.length,
    0,
  );

  assert.equal(routedCount, 1000);
  assert.equal(buckets[0].length, 1000);
  assert.equal(buckets[0][0].json._decision, "allow");
  assert.ok(
    elapsedMs < 5000,
    `expected 1000-item batch under 5s, took ${elapsedMs}ms`,
  );
});
