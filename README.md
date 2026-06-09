# n8n-nodes-rule-evaluator

English | [Русский](./docs/README.ru.md) | [Español](./docs/README.es.md) | [中文](./docs/README.zh.md)

[![npm version](https://img.shields.io/npm/v/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![npm downloads](https://img.shields.io/npm/dw/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

> Put your workflow rules in one node -- one place to edit policies.

**n8n-nodes-rule-evaluator** is an n8n community node package for deterministic business-rule decisions.

For each input item, it evaluates rule conditions, resolves conflicts using a fixed priority strategy (`Business Rules`) or a table hit policy (`Decision Table`), and routes the item to the resolved outcome.

## Before and after

**Before** -- policies scattered across the canvas:

```
[Trigger] -> [IF ...] -> [IF ...] -> [Switch] -> ...
                |            |
                v            v
             [IF ...]    [Merge] -> ...
```

**After** -- rules consolidated into one node:

```
[Trigger] -> [Business Rules] -> (Allow / Escalate / Deny / ...)
```

Same item, same inputs; one place to edit when policies change.

## In 15 seconds

1. Drop **Business Rules** or **Decision Table** on the canvas.
2. Add rules/cases with the native n8n condition UI.
3. Connect outputs -- routing is built in.

## What you get

- **One node for many rules** -- all policies in one place.
- **Built-in routing** -- no extra `Switch` for standard outcomes.
- **Two decision patterns**:
  - **Business Rules** (enum outcomes with a priority ladder)
  - **Decision Table** (switchless table routing with hit policies)
- **Legacy compatibility** -- **Rule Enricher** for existing workflows.

## Nodes in this package

- **Business Rules**: evaluate independent rules per item, resolve conflicts with a fixed priority ladder, and route to the resolved outcome.
- **Decision Table**: switchless, table-based routing with user-defined string decisions and four hit policies: `Unique`, `First`, `Unanimous`, `Collect`.
- **Rule Enricher**: legacy helper that writes the decision to a field (default `_decision`); you add a `Switch` for routing.

## Which node should I use?


|          | Business Rules                                 | Decision Table                                 |
| -------- | ---------------------------------------------- | ---------------------------------------------- |
| Shape    | Independent rules                              | Table rows (cases)                             |
| Overlap  | Several rules can match                        | Cases are usually mutually exclusive           |
| Outcomes | `allow`, `escalate`, `silent`, `deny`, `error` | Your own string decisions                      |
| Routing  | Output routing by resolved enum outcome        | Switchless dynamic outputs based on hit policy |


Not sure? Start with **Business Rules**.

### Business Rules

Use when you have **many independent checks** (several can be true at once) and you need **one final decision**.

Decision priority (low -> high):

`allow` < `escalate` < `silent` < `deny` < `error`

If a rule condition fails to evaluate, the outcome is `error`.

### Decision Table

Use when your logic is **case-based**: each case combines several conditions (AND) and maps to a **string decision**.

Decision Table is **switchless**: it exposes dynamic outputs depending on `Hit Policy`.

Hit policies (all available in `1.2.x`):

- `Unique` (default): no match -> default, one match -> case decision, 2+ matches -> runtime error
- `First`: first matching case wins (top-to-bottom row order)
- `Unanimous`: all matched cases must agree (otherwise runtime error)
- `Collect`: gathers all matched case decisions into an array and routes to a single `decision` output

## Quick Start

Check out our [Workflow Examples](./docs/examples.md) to import these directly into your n8n canvas.

### Try Business Rules

Build a chat gate with built-in routing -- no IF chain before every reply.

1. Add **When chat message received**, then **Business Rules**.
2. Add Rule 1: `risk_score >= 80` -> `deny`
3. Add Rule 2: `is_suspicious = true` -> `escalate`
4. Set **Default Decision** to `allow`
5. Wire outputs:
  - **Allow** -> **Answer** (Send Message)
  - **Escalate** -> **Request Approval** (Send and Wait) -> human approval
  - **Deny** -> **Not Permitted** (Send Message)
6. Run with `{ "risk_score": 50, "is_suspicious": true }` -> item exits **Escalate** (human review).

```
[When chat message received] -> [Business Rules] -- Allow -----> [Answer]
                                    |-- Escalate -> [Request Approval] -> ...
                                    +-- Deny -----> [Not Permitted]
```

### Try Decision Table

1. Add the **Decision Table** node.
2. Add Case 1: `status = "pending"` AND `days_open > 7` -> `escalate`
3. Add Case 2: `status = "pending"` -> `wait`
4. Set **Default Decision** to `closed`
5. Set **Hit Policy** to `First` (top row wins when several cases match).
6. Connect outputs and run with `{ "status": "pending", "days_open": 10 }` -> item exits as `escalate`.

Both cases match, but `First` picks Case 1 because it is above Case 2. No code. Native n8n condition UI.

For overlapping cases where order matters, use `First`. For conflict detection, use `Unanimous`.

## Reference

**Installation**

**n8n UI**

1. Settings -> Community Nodes -> Install
2. Package name: `n8n-nodes-rule-evaluator`
3. Restart n8n if prompted

**npm / Docker**

```bash
npm install n8n-nodes-rule-evaluator
```

Restart n8n after install.

**Business Rules parameters**


| Parameter             | Description                                                              |
| --------------------- | ------------------------------------------------------------------------ |
| Default Decision      | One of: `allow`, `escalate`, `silent`, `deny`, `error`. Default: `deny`. |
| Rules                 | Fixed collection. Each rule: one IF-style condition and a **Decision**.  |
| Output Field Name     | Field written to JSON. Default: `_decision`.                             |
| Include Matched Rules | Adds `matched_rules` for debugging (ruleIndex and decision).             |


**Decision Table parameters**


| Parameter            | Description                                                            |
| -------------------- | ---------------------------------------------------------------------- |
| Default Decision     | Used when no case matches.                                             |
| Cases                | Each case: multiple conditions (AND) and a custom string **Decision**. |
| Hit Policy           | `Unique` / `First` / `Unanimous` / `Collect`. Default: `Unique`.       |
| Output Field Name    | Default: `_decision`.                                                  |
| Include Matched Case | Debug: which case matched.                                             |


**Output type for `{Output Field Name}`**:

- `Unique` / `First` / `Unanimous`: `string`
- `Collect`: `string[]` (array of matched decisions in case order)

**Rule Enricher (legacy)**

Deprecated but supported for existing workflows.

It writes the resolved decision to the configured output field (default `_decision`); you add a `Switch` node for routing.

New workflows should use **Business Rules**.

### Output example

```json
{
  "message": "Can you help with my order?",
  "is_suspicious": true,
  "risk_score": 50,
  "_decision": "escalate"
}
```

### Compatibility

- **Requires n8n >= 1.0.0** (uses the modern Condition UI).
- Any n8n instance with community nodes enabled. No credentials are required.
- Package scope for `1.2.x`: **Decision Table**, **Business Rules**, and **Rule Enricher** (legacy).
- One output item per input item; **Business Rules** routes each item to exactly one dynamic output.

### Troubleshooting

- Unexpected `error`: check expressions and mapped fields; unevaluable conditions become `error`.
- No match: verify input fields and **Default Decision**.
- Debug visibility: enable **Include Matched Rules** / **Include Matched Case**.

**Testing and development**

```bash
npm test
npm run verify
```

