# n8n-nodes-rule-evaluator

[![npm version](https://img.shields.io/npm/v/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![npm downloads](https://img.shields.io/npm/dw/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

`Rule Evaluator` is an n8n community node for deterministic business-rule decisions.

It evaluates multiple rules per item using n8n's native filter UI, resolves conflicts with a fixed priority ladder, and writes one final decision back to the output JSON.

## Why Use Rule Evaluator

Use this node when you want rule-based decisions in n8n without moving logic into a `Code` node.

- Evaluate multiple candidate rules for each item.
- Resolve conflicting matches with a predictable priority order.
- Keep the workflow in one stream instead of branching immediately.
- Write the result to a single field such as `_decision`.
- Optionally expose matched-rule details for debugging.
- Pair it with a standard n8n `Switch` node for routing.

## Quick Start

1. Install `n8n-nodes-rule-evaluator`.
2. Add `Rule Evaluator` after the node that produces your input items.
3. Set `Default Decision` to the fallback outcome you want when nothing matches.
4. Add one or more rules with `Add Rule`.
5. Keep `Output Field Name` as `_decision` or choose your own field.
6. Add a `Switch` node after `Rule Evaluator` and route on `_decision`.

Example setup:

- Rule 1: `amount > 500` -> `allow`
- Rule 2: `amount > 1000` -> `silent`
- Default Decision: `deny`

For an item with `amount = 1200`, the final output decision will be `silent`.

## What This Node Does

- Accepts a list of rules in a fixed collection.
- Evaluates each rule using n8n's IF-style condition UI.
- Collects all matched rule decisions for the current item.
- Chooses the highest-priority matched decision.
- Falls back to `Default Decision` when no rule matches.
- Writes the final result to a configurable output field.

This node is an enricher. It does not split output into branches.

## Decision Priority

When more than one rule matches, `Rule Evaluator` uses this fixed priority ladder from low to high:

`allow` < `escalate` < `silent` < `deny` < `error`

This means:

- `silent` overrides `allow`
- `deny` overrides `silent`
- `error` overrides everything

If a rule condition fails to evaluate, the item decision is escalated to `error`.

## Common Use Cases

### Policy Routing Before a `Switch`

Evaluate business policy once, store the result in `_decision`, then route cleanly with a standard n8n `Switch` node.

### Transaction or Risk Screening

Assign outcomes such as `allow`, `escalate`, or `deny` based on amount, sender, region, score, or other item fields.

### Moderation and Trust Rules

Apply multiple safety or abuse checks and collapse them to one final moderation outcome.

### Lead Qualification or Internal Review

Mark records for approval, silent handling, escalation, or rejection before downstream automation continues.

## Installation

### Option 1: n8n UI

1. Open **Settings** -> **Community Nodes**.
2. Select **Install**.
3. Enter package name: `n8n-nodes-rule-evaluator`.
4. Approve installation and restart n8n if requested.

### Option 2: npm / Docker

Install the package in the same environment where n8n runs:

```bash
npm install n8n-nodes-rule-evaluator
```

Then restart n8n.

## Node Parameters

### Default Decision

- Type: options
- Values: `allow`, `escalate`, `silent`, `deny`, `error`
- Default: `deny`
- Used when no business rule matches

### Business Rules

- Type: fixed collection with `Add Rule`
- Each rule contains:
  - **Rule**: one IF-style condition (`maxConditions = 1`)
  - **Decision**: one of `allow`, `escalate`, `silent`, `deny`, `error`

### Options

- **Output Field Name**: string, default `_decision`
- **Include Matched Rules**: boolean, default `false`

When `Include Matched Rules` is enabled, the output includes a `matched_rules` array with:

- `ruleIndex`: 1-based rule index
- `decision`: decision produced by that matched rule

## How Decision Resolution Works

For each input item:

1. Evaluate every rule condition.
2. Collect all matched rule decisions.
3. Compare matched decisions using the fixed priority ladder.
4. Choose the highest-priority matched decision.
5. If nothing matched, use `Default Decision`.
6. Write the result to the output field.

## Output Examples

### Basic Output

Input item:

```json
{
  "sender_id": "ivan",
  "amount": 1200
}
```

Rules:

- `amount > 500` -> `allow`
- `amount > 1000` -> `silent`

Result:

```json
{
  "sender_id": "ivan",
  "amount": 1200,
  "_decision": "silent"
}
```

`silent` wins because it has higher priority than `allow`.

### Output with Matched Rules

If `Include Matched Rules` is enabled, the same item can produce:

```json
{
  "sender_id": "ivan",
  "amount": 1200,
  "_decision": "silent",
  "matched_rules": [
    {
      "ruleIndex": 1,
      "decision": "allow"
    },
    {
      "ruleIndex": 2,
      "decision": "silent"
    }
  ]
}
```

### No Rule Matched

If no rule matches, the node writes the `Default Decision`:

```json
{
  "sender_id": "ivan",
  "amount": 100,
  "_decision": "deny"
}
```

## Typical Workflow Pattern

The most common pattern is:

1. Use `Rule Evaluator` to calculate `_decision`
2. Use a standard n8n `Switch` node to route by `_decision`

This keeps the rule logic centralized while keeping downstream workflow routing simple.

## Compatibility and Notes

- Designed for n8n environments where community nodes can be installed.
- No credentials are required.
- One output item is produced for each input item.
- Input `json` and normal item flow stay intact while the decision is added as enrichment.
- This node does not create branches by itself.

## Troubleshooting

### Unexpected `error` Decision

Check rule expressions and mapped fields in each condition. A rule condition that cannot be evaluated escalates the item decision to `error`.

### No Rules Matched

Verify the values available on the incoming item and confirm that your `Default Decision` is the fallback you want.

### Need Better Debug Visibility

Enable `Include Matched Rules` to inspect which rules matched and what decision each one produced.

## Testing and Development

Run tests with:

```bash
npm test
```

Automated coverage includes:

- Highest-priority decision selection across multiple matched rules
- Fallback to `Default Decision` when no rules match
- Escalation to `error` when rule condition evaluation fails
- Invalid decision handling
- `continueOnFail` behavior and error sanitization
- Empty input handling
- Multi-item mixed batch behavior
- Binary preservation
- Stability with a large number of rules
- Chained execution scenarios

Quality checks before release:

```bash
npm run lint
npm run lint:n8n
npm test
```
