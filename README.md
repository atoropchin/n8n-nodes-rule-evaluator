# n8n-nodes-rule-evaluator

English | [Русский](./docs/README.ru.md) | [Español](./docs/README.es.md) | [中文](./docs/README.zh.md)

[npm version](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[npm downloads](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[License: MIT](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

**n8n-nodes-rule-evaluator** is an n8n community node package for deterministic business-rule decisions.

For each item it evaluates multiple rules using n8n's native condition UI, resolves conflicts with a fixed priority ladder, and writes one final decision to the output JSON.

## Nodes in This Package

| Node | Role |
| --- | --- |
| **Business Rules** | Evaluates configured rules for each item and routes workflow execution to the output that matches the resolved decision.<br><br>Each rule assigns one of five outcomes: `allow`, `escalate`, `silent`, `deny`, or `error`.<br><br>When multiple rules match, outcomes are ranked on a fixed priority ladder (`allow` lowest → `error` highest); the highest-ranked outcome wins.<br><br>If no rule matches, the configured default decision applies. |
| **Rule Enricher** | Legacy. Writes the decision to a configurable field (default `_decision`); add a `Switch` for routing. |


## Quick Start

1. Install `n8n-nodes-rule-evaluator`.
2. New workflows: add **Business Rules**. Existing workflows: keep **Rule Enricher** and a `Switch` on the output field.
3. Set **Default Decision** for when no rule matches.
4. Add rules with **Add Rule** (one IF-style condition per rule).
5. Keep **Output Field Name** as `_decision` or choose your own.

Example:

- Rule 1: `amount > 500` → `allow`
- Rule 2: `amount > 1000` → `silent`
- Default Decision: `deny`

For `amount = 1200`, the result is `silent` (see [Decision Priority](#decision-priority)).

## How It Works

For each input item:

1. Evaluate every rule condition (n8n IF-style UI).
2. Collect matched rule decisions.
3. Pick the highest-priority match (see below).
4. If nothing matched, use **Default Decision**.
5. Write the result to **Output Field Name** (and route in **Business Rules**).

**Rule Enricher** keeps a single output stream. **Business Rules** uses the same evaluation logic but sends each item to a dynamic output (`Allow`, `Deny`, etc.).

## Decision Priority

When more than one rule matches (low → high):

`allow` < `escalate` < `silent` < `deny` < `error`

Examples: `silent` overrides `allow`; `deny` overrides `silent`; `error` overrides everything.

If a rule condition fails to evaluate, the decision is `error`.

## Installation

### Option 1: n8n UI

1. Open **Settings** → **Community Nodes** → **Install**.
2. Enter package name: `n8n-nodes-rule-evaluator`.
3. Approve installation and restart n8n if requested.

### Option 2: npm / Docker

```bash
npm install n8n-nodes-rule-evaluator
```

Then restart n8n.

## Node Parameters

### Default Decision

- Values: `allow`, `escalate`, `silent`, `deny`, `error`
- Default: `deny`
- Used when no business rule matches

### Business Rules (collection)

- Fixed collection with **Add Rule**
- Each rule: one IF-style condition (`maxConditions = 1`) and a **Decision**

### Options

- **Output Field Name**: string, default `_decision`
- **Include Matched Rules**: boolean, default `false` — adds `matched_rules` with `ruleIndex` (1-based) and `decision`

## Output Examples

### Basic

```json
{
  "sender_id": "ivan",
  "amount": 1200,
  "_decision": "silent"
}
```

Rules: `amount > 500` → `allow`, `amount > 1000` → `silent`.

### With Matched Rules

```json
{
  "sender_id": "ivan",
  "amount": 1200,
  "_decision": "silent",
  "matched_rules": [
    { "ruleIndex": 1, "decision": "allow" },
    { "ruleIndex": 2, "decision": "silent" }
  ]
}
```

### No Rule Matched

```json
{
  "sender_id": "ivan",
  "amount": 100,
  "_decision": "deny"
}
```

(Default Decision was `deny`.)

## Compatibility and Notes

- Requires an n8n instance where community nodes can be installed. No credentials are required.
- Package scope for `1.1.x`: **Business Rules** and **Rule Enricher** only.
- **Rule Enricher** is deprecated but kept for backward compatibility; use **Business Rules** for new workflows.
- One output item per input item; **Business Rules** routes each item to exactly one dynamic output.

## Troubleshooting

- **Unexpected `error`**: check rule expressions and mapped fields; unevaluable conditions become `error`.
- **No rules matched**: verify item fields and **Default Decision**.
- **Debug visibility**: enable **Include Matched Rules**.

## Testing and Development

```bash
npm test
npm run verify
```

