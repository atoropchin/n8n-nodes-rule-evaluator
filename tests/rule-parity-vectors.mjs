export const PARITY_VECTORS = [
  {
    name: "uses highest priority among matched rules",
    defaultDecision: "deny",
    rulesData: [{ decision: "allow" }, { decision: "silent" }],
    conditionResults: [true, true],
    expectedDecision: "silent",
  },
  {
    name: "uses default decision when no rules match",
    defaultDecision: "escalate",
    rulesData: [{ decision: "allow" }, { decision: "deny" }],
    conditionResults: [false, false],
    expectedDecision: "escalate",
  },
  {
    name: "escalates to error when condition evaluation fails",
    defaultDecision: "allow",
    rulesData: [{ decision: "allow" }],
    conditionResults: [true],
    conditionErrorIndices: [0],
    expectedDecision: "error",
  },
  {
    name: "escalates to error for invalid matched rule decision",
    defaultDecision: "allow",
    rulesData: [{ decision: "invalid" }],
    conditionResults: [true],
    expectedDecision: "error",
  },
  {
    name: "escalates to error for invalid default decision",
    defaultDecision: "invalid",
    rulesData: [],
    conditionResults: [],
    expectedDecision: "error",
  },
];
