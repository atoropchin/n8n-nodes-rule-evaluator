import assert from "node:assert/strict";
import test from "node:test";
import ruleEvaluatorModule from "../dist/nodes/RuleEvaluator/RuleEvaluator.node.js";

const { RuleEvaluator } = ruleEvaluatorModule;

function createMockContext({
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
            "Expected getNodeParameter condition call with { extractValue: true }",
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
      return { name: "Rule Evaluator" };
    },
  };
}

test("continueOnFail keeps input data and sets decision to error", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [
      { json: { id: 4, sender: "ivan" }, binary: { file: { data: "abc" } } },
    ],
    outputFieldName: "result",
    continueOnFail: true,
    throwOnParameter: "defaultDecision",
  });

  const [output] = await node.execute.call(context);
  assert.equal(output.length, 1);
  assert.equal(output[0].json.id, 4);
  assert.equal(output[0].json.sender, "ivan");
  assert.equal(output[0].json.result, "error");
  assert.equal(output[0].json.error, "internal_error");
  assert.deepEqual(output[0].binary, { file: { data: "abc" } });
  assert.deepEqual(output[0].pairedItem, { item: 0 });
});

test("throws NodeOperationError when continueOnFail is disabled", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 401 } }],
    continueOnFail: false,
    throwOnParameter: "defaultDecision",
  });

  await assert.rejects(
    () => node.execute.call(context),
    (error) =>
      error instanceof Error &&
      error.constructor?.name === "NodeOperationError" &&
      error.message.includes("Forced parameter error: defaultDecision"),
  );
});

test("falls back to _decision when output field name is blank", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 6 } }],
    defaultDecision: "allow",
    rulesData: [],
    outputFieldName: "   ",
  });

  const [output] = await node.execute.call(context);
  assert.equal(output[0].json._decision, "allow");
  assert.equal(output[0].json["   "], undefined);
});

test("includeMatchedRules adds matched_rules with 1-based ruleIndex", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 8 } }],
    defaultDecision: "deny",
    includeMatchedRules: true,
    rulesData: [
      { decision: "allow" },
      { decision: "silent" },
      { decision: "escalate" },
    ],
    conditionResults: [true, false, true],
  });

  const [output] = await node.execute.call(context);
  assert.equal(output[0].json._decision, "escalate");
  assert.deepEqual(output[0].json.matched_rules, [
    { ruleIndex: 1, decision: "allow" },
    { ruleIndex: 3, decision: "escalate" },
  ]);
});

test("returns empty output when input items are empty", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [],
  });

  const [output] = await node.execute.call(context);
  assert.deepEqual(output, []);
});

test("preserves binary data on successful processing path", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 10 }, binary: { file: { data: "xyz" } } }],
    defaultDecision: "allow",
    rulesData: [],
  });

  const [output] = await node.execute.call(context);
  assert.equal(output[0].json._decision, "allow");
  assert.deepEqual(output[0].binary, { file: { data: "xyz" } });
});

test("continueOnFail handles non-Error throws without crashing", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 12 } }],
    continueOnFail: true,
    customGetNodeParameter(name) {
      if (name === "defaultDecision") {
        throw "oops";
      }
      if (name === "options.outputFieldName") {
        return "_decision";
      }
      if (name === "rules.ruleBlock") {
        return [];
      }
      if (name === "options.includeMatchedRules") {
        return false;
      }
      return undefined;
    },
  });

  const [output] = await node.execute.call(context);
  assert.equal(output[0].json._decision, "error");
  assert.equal(output[0].json.error, "Technical error during node execution");
});

test("continueOnFail supports mixed success and failure in same batch", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 13 } }, { json: { id: 14 } }],
    continueOnFail: true,
    customGetNodeParameter(name, itemIndex, defaultValue) {
      if (name === "options.outputFieldName") return "_decision";
      if (name === "rules.ruleBlock") return [];
      if (name === "options.includeMatchedRules") return false;
      if (name === "defaultDecision") {
        if (itemIndex === 1) {
          throw new Error("Forced item-level failure");
        }
        return "allow";
      }
      return defaultValue;
    },
  });

  const [output] = await node.execute.call(context);
  assert.equal(output.length, 2);
  assert.equal(output[0].json.id, 13);
  assert.equal(output[0].json._decision, "allow");
  assert.equal(output[1].json.id, 14);
  assert.equal(output[1].json._decision, "error");
  assert.equal(output[1].json.error, "internal_error");
});

test("includeMatchedRules=false does not emit matched_rules after later escalation", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 15 } }],
    defaultDecision: "allow",
    includeMatchedRules: false,
    rulesData: [{ decision: "allow" }, { decision: "bad-decision" }],
    conditionResults: [true, true],
  });

  const [output] = await node.execute.call(context);
  assert.equal(output[0].json._decision, "error");
  assert.equal(output[0].json.matched_rules, undefined);
});

test("smoke: condition extraction uses getNodeParameter with extractValue=true", async () => {
  const node = new RuleEvaluator();
  const context = createMockContext({
    items: [{ json: { id: 16 } }],
    defaultDecision: "deny",
    rulesData: [{ decision: "allow" }],
    conditionResults: [true],
    requireExtractValueOnCondition: true,
  });

  const [output] = await node.execute.call(context);
  assert.equal(output[0].json._decision, "allow");
});

test("rule enricher disables expressions for decision options", () => {
  const node = new RuleEvaluator();
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
