import assert from "node:assert/strict";
import test from "node:test";

import decisionTableModule from "../dist/nodes/DecisionTable/DecisionTable.node.js";

const { DecisionTable, configuredOutputs, collectVisibleDecisions } =
  decisionTableModule;

function evaluateNodeExpression(expression, parameters) {
  assert.equal(typeof expression, "string");
  const match = expression.match(/=\{\{([\s\S]*)\}\}/);
  assert.ok(match, `Expected n8n expression format, got: ${expression}`);
  const expressionBody = match[1];
  const evaluator = new Function("$parameter", `return (${expressionBody});`);
  return evaluator(parameters);
}

function createMockContext({
  nodeName = "Decision Table",
  items,
  defaultDecision = "deny",
  hitPolicy = "UNIQUE",
  includeMatchedCase = false,
  outputFieldName = "_decision",
  casesData = [],
  conditionResultsByItem = {},
  conditionErrorByItem = {},
  continueOnFail = false,
  customGetNodeParameter,
  throwOnParameter,
}) {
  const nodeParameters = {
    defaultDecision,
    cases: {
      caseBlock: casesData,
    },
    options: {
      hitPolicy,
      includeMatchedCase,
      outputFieldName,
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

      if (name === "defaultDecision") {
        return defaultDecision;
      }
      if (name === "options.hitPolicy") {
        return hitPolicy;
      }
      if (name === "options.outputFieldName") {
        return outputFieldName;
      }
      if (name === "options.includeMatchedCase") {
        return includeMatchedCase;
      }
      if (name === "cases.caseBlock") {
        return casesData;
      }

      const match = name.match(
        /^cases\.caseBlock\[(\d+)\]\.conditions\.conditionBlock\[(\d+)\]\.condition$/,
      );
      if (match) {
        if (options?.extractValue !== true) {
          throw new Error(
            "Expected condition call with { extractValue: true }",
          );
        }

        const caseIndex = Number(match[1]);
        const conditionIndex = Number(match[2]);
        if (conditionErrorByItem[itemIndex]?.[caseIndex]?.[conditionIndex]) {
          throw new Error("Forced condition error");
        }

        return (
          conditionResultsByItem[itemIndex]?.[caseIndex]?.[conditionIndex] ??
          false
        );
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

const OUTPUT_VECTORS = [
  {
    name: "unique keeps first appearance order and appends default",
    parameters: {
      defaultDecision: "B",
      cases: {
        caseBlock: [{ decision: "A" }, { decision: "B" }, { decision: "A" }],
      },
      options: { hitPolicy: "UNIQUE" },
    },
    expected: [
      { type: "main", displayName: "A" },
      { type: "main", displayName: "B" },
    ],
  },
  {
    name: "collect always has one decision output",
    parameters: {
      defaultDecision: "B",
      cases: {
        caseBlock: [{ decision: "A" }, { decision: "B" }],
      },
      options: { hitPolicy: "COLLECT" },
    },
    expected: [{ type: "main", displayName: "decision" }],
  },
];

for (const vector of OUTPUT_VECTORS) {
  test(`output configuration: ${vector.name}`, () => {
    const node = new DecisionTable();
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

test("description.outputs expression stays in parity with configuredOutputs", () => {
  const node = new DecisionTable();
  const outputsExpression = node.description.outputs;
  const vectors = [
    {
      defaultDecision: "deny",
      cases: { caseBlock: [] },
      options: { hitPolicy: "UNIQUE" },
    },
    {
      defaultDecision: "reject",
      cases: { caseBlock: [{ decision: "approve" }, { decision: "review" }] },
      options: { hitPolicy: "FIRST" },
    },
    {
      defaultDecision: "deny",
      cases: { caseBlock: [{ decision: "allow" }, { decision: "allow" }] },
      options: { hitPolicy: "UNANIMOUS" },
    },
    {
      defaultDecision: "deny",
      cases: { caseBlock: [{ decision: "allow" }] },
      options: { hitPolicy: "COLLECT" },
    },
  ];

  for (const parameters of vectors) {
    const expressionOutputs = evaluateNodeExpression(
      outputsExpression,
      parameters,
    );
    const tsOutputs = configuredOutputs(parameters);
    assert.deepEqual(expressionOutputs, tsOutputs);
  }
});

test("collectVisibleDecisions returns single collect port", () => {
  const visible = collectVisibleDecisions({
    defaultDecision: "deny",
    cases: { caseBlock: [{ decision: "A" }, { decision: "B" }] },
    options: { hitPolicy: "COLLECT" },
  });
  assert.deepEqual(visible, ["decision"]);
});

test("unique routes by decision outputs", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 1 } }, { json: { id: 2 } }],
    defaultDecision: "B",
    hitPolicy: "UNIQUE",
    casesData: [
      {
        caseName: "case A",
        decision: "A",
        conditions: { conditionBlock: [{ condition: { left: 1 } }] },
      },
      {
        caseName: "case B",
        decision: "B",
        conditions: { conditionBlock: [{ condition: { left: 2 } }] },
      },
    ],
    conditionResultsByItem: {
      0: { 0: { 0: true }, 1: { 0: false } },
      1: { 0: { 0: false }, 1: { 0: true } },
    },
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].length, 1);
  assert.equal(buckets[0][0].json._decision, "A");
  assert.equal(buckets[1].length, 1);
  assert.equal(buckets[1][0].json._decision, "B");
});

test("first picks the top-most matched case", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 3 } }],
    defaultDecision: "C",
    hitPolicy: "FIRST",
    includeMatchedCase: true,
    casesData: [
      {
        caseName: "first",
        decision: "A",
        conditions: { conditionBlock: [{ condition: { left: 1 } }] },
      },
      {
        caseName: "second",
        decision: "B",
        conditions: { conditionBlock: [{ condition: { left: 2 } }] },
      },
    ],
    conditionResultsByItem: {
      0: { 0: { 0: true }, 1: { 0: true } },
    },
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets[0].length, 1);
  assert.equal(buckets[0][0].json._decision, "A");
  assert.deepEqual(buckets[0][0].json.matched_case, {
    index: 1,
    name: "first",
  });
});

test("unanimous throws on conflicting matched decisions", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 4 } }],
    defaultDecision: "C",
    hitPolicy: "UNANIMOUS",
    casesData: [
      {
        decision: "A",
        conditions: { conditionBlock: [{ condition: { left: 1 } }] },
      },
      {
        decision: "B",
        conditions: { conditionBlock: [{ condition: { left: 2 } }] },
      },
    ],
    conditionResultsByItem: {
      0: { 0: { 0: true }, 1: { 0: true } },
    },
  });

  await assert.rejects(
    async () => node.execute.call(context),
    /Hit Policy Unanimous conflict/,
  );
});

test("unique throws on multiple matched cases", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 5 } }],
    defaultDecision: "C",
    hitPolicy: "UNIQUE",
    casesData: [
      {
        caseName: "dup-1",
        decision: "A",
        conditions: { conditionBlock: [{ condition: { left: 1 } }] },
      },
      {
        caseName: "dup-2",
        decision: "B",
        conditions: { conditionBlock: [{ condition: { left: 2 } }] },
      },
    ],
    conditionResultsByItem: {
      0: { 0: { 0: true }, 1: { 0: true } },
    },
  });

  await assert.rejects(
    async () => node.execute.call(context),
    /Hit Policy Unique requires a single matched case/,
  );
});

test("collect returns ordered array and single decision port", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 6 } }],
    defaultDecision: "Z",
    hitPolicy: "COLLECT",
    includeMatchedCase: true,
    casesData: [
      {
        caseName: "one",
        decision: "A",
        conditions: { conditionBlock: [{ condition: { left: 1 } }] },
      },
      {
        caseName: "two",
        decision: "B",
        conditions: { conditionBlock: [{ condition: { left: 2 } }] },
      },
      {
        caseName: "three",
        decision: "A",
        conditions: { conditionBlock: [{ condition: { left: 3 } }] },
      },
    ],
    conditionResultsByItem: {
      0: { 0: { 0: true }, 1: { 0: true }, 2: { 0: true } },
    },
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].length, 1);
  assert.deepEqual(buckets[0][0].json._decision, ["A", "B", "A"]);
  assert.deepEqual(buckets[0][0].json.matched_cases, [
    { index: 1, name: "one", decision: "A" },
    { index: 2, name: "two", decision: "B" },
    { index: 3, name: "three", decision: "A" },
  ]);
});

test("collect returns [defaultDecision] when no case matched", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 7 } }],
    defaultDecision: "fallback",
    hitPolicy: "COLLECT",
    casesData: [
      {
        decision: "A",
        conditions: { conditionBlock: [{ condition: { left: 1 } }] },
      },
    ],
    conditionResultsByItem: {
      0: { 0: { 0: false } },
    },
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 1);
  assert.deepEqual(buckets[0][0].json._decision, ["fallback"]);
});

test("fallback routes non-visible decision to default output without mutation", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 8 } }, { json: { id: 9 } }],
    customGetNodeParameter(name, itemIndex, defaultValue, options) {
      if (name === "defaultDecision") return "B";
      if (name === "options.hitPolicy") return "FIRST";
      if (name === "options.outputFieldName") return "_decision";
      if (name === "options.includeMatchedCase") return false;
      if (name === "cases.caseBlock") {
        if (itemIndex === 0) {
          return [
            {
              decision: "A",
              conditions: { conditionBlock: [{ condition: { a: 1 } }] },
            },
            {
              decision: "B",
              conditions: { conditionBlock: [{ condition: { b: 1 } }] },
            },
          ];
        }

        return [
          {
            decision: "C",
            conditions: { conditionBlock: [{ condition: { c: 1 } }] },
          },
        ];
      }

      const match = name.match(
        /^cases\.caseBlock\[(\d+)\]\.conditions\.conditionBlock\[(\d+)\]\.condition$/,
      );
      if (match) {
        if (options?.extractValue !== true) {
          throw new Error("Expected extractValue");
        }
        return true;
      }

      return defaultValue;
    },
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 2);
  assert.equal(buckets[0].length, 1);
  assert.equal(buckets[0][0].json._decision, "A");
  assert.equal(buckets[1].length, 1);
  assert.equal(buckets[1][0].json._decision, "C");
});

test("validates duplicate condition signatures for unique policy", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 10 } }],
    defaultDecision: "B",
    hitPolicy: "UNIQUE",
    casesData: [
      {
        decision: "A",
        conditions: {
          conditionBlock: [{ condition: { left: "={{$json.a}}", id: "x" } }],
        },
      },
      {
        decision: "B",
        conditions: {
          conditionBlock: [{ condition: { left: "={{$json.a}}", id: "y" } }],
        },
      },
    ],
  });

  await assert.rejects(
    async () => node.execute.call(context),
    /identical condition sets/,
  );
});

test("continueOnFail returns safe error output", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 11 } }],
    continueOnFail: true,
    throwOnParameter: "defaultDecision",
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].length, 1);
  assert.equal(buckets[0][0].json._decision, "error");
  assert.equal(buckets[0][0].json.error, "internal_error");
});

test("preserves binary and pairedItem", async () => {
  const node = new DecisionTable();
  const context = createMockContext({
    items: [{ json: { id: 12 }, binary: { file: { data: "abc" } } }],
    defaultDecision: "B",
    hitPolicy: "UNIQUE",
    casesData: [],
  });

  const buckets = await node.execute.call(context);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].length, 1);
  assert.deepEqual(buckets[0][0].binary, { file: { data: "abc" } });
  assert.deepEqual(buckets[0][0].pairedItem, { item: 0 });
});
