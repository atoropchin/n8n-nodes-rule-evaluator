# n8n-nodes-rule-evaluator

[English](../README.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | 中文

[![npm version](https://img.shields.io/npm/v/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![npm downloads](https://img.shields.io/npm/dw/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

**n8n-nodes-rule-evaluator** 是用于确定性业务规则决策的 n8n 社区节点包。

对每个 item 通过 n8n 原生条件 UI 评估多条规则，按固定优先级解决冲突，并将最终决策写入输出 JSON。

## 包内节点

| 节点 | 作用 |
|------|------|
| **Business Rules** | 推荐使用。评估规则并通过动态输出路由 item（无需外部 `Switch`）。 |
| **Rule Enricher** | 旧版。将决策写入可配置字段（默认 `_decision`）；路由需配合 `Switch`。 |

## 快速开始

1. 安装 `n8n-nodes-rule-evaluator`。
2. 新工作流使用 **Business Rules**；现有工作流可继续使用 **Rule Enricher** 及对输出字段的 `Switch`。
3. 设置 **Default Decision** 作为无匹配时的回退。
4. 通过 **Add Rule** 添加规则（每条规则一个 IF 风格条件）。
5. **Output Field Name** 默认为 `_decision`，可自定义。

示例：

- 规则 1：`amount > 500` → `allow`
- 规则 2：`amount > 1000` → `silent`
- Default Decision：`deny`

当 `amount = 1200` 时，结果为 `silent`（见[决策优先级](#决策优先级)）。

## 工作原理

对每个输入 item：

1. 评估所有规则条件（n8n IF 风格 UI）。
2. 收集匹配规则的决策。
3. 选取优先级最高者（见下文）。
4. 无匹配时使用 **Default Decision**。
5. 写入 **Output Field Name**（在 **Business Rules** 中同时路由）。

**Rule Enricher** 保持单输出流。**Business Rules** 使用相同评估逻辑，但将 item 路由到动态输出（`Allow`、`Deny` 等）。

## 决策优先级

多条规则同时匹配时（从低到高）：

`allow` < `escalate` < `silent` < `deny` < `error`

例如：`silent` 覆盖 `allow`；`deny` 覆盖 `silent`；`error` 覆盖一切。

条件无法求值时，决策为 `error`。

## 安装

### n8n UI

1. **Settings** → **Community Nodes** → **Install**
2. 包名：`n8n-nodes-rule-evaluator`
3. 确认安装，必要时重启 n8n。

### npm / Docker

```bash
npm install n8n-nodes-rule-evaluator
```

然后重启 n8n。

## 节点参数

### Default Decision

- 可选值：`allow`、`escalate`、`silent`、`deny`、`error`
- 默认：`deny`
- 无规则匹配时使用

### Business Rules（规则集合）

- 固定集合，通过 **Add Rule** 添加
- 每条规则：一条 IF 条件和一个 **Decision**

### Options

- **Output Field Name** — 默认 `_decision`
- **Include Matched Rules** — 输出 `matched_rules`，含 `ruleIndex`（从 1 起）和 `decision`

## 输出示例

### 基本输出

```json
{
  "sender_id": "ivan",
  "amount": 1200,
  "_decision": "silent"
}
```

规则：`amount > 500` → `allow`，`amount > 1000` → `silent`。

### 含 matched rules

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

### 无匹配

```json
{
  "sender_id": "ivan",
  "amount": 100,
  "_decision": "deny"
}
```

（Default Decision 为 `deny`。）

## 兼容性

- 需要支持 community nodes 的 n8n 实例，无需 credentials。
- `1.1.x` 仅包含 **Business Rules** 和 **Rule Enricher**。
- **Rule Enricher** 已 deprecated，保留以兼容旧工作流；新工作流请用 **Business Rules**。
- 每个输入 item 对应一个输出 item；**Business Rules** 将 item 路由到恰好一个动态输出。

## 故障排查

- **意外的 `error`**：检查表达式与字段；无法求值的条件会得到 `error`。
- **无规则匹配**：检查 item 数据与 **Default Decision**。
- **调试**：启用 **Include Matched Rules**。

## 开发与测试

```bash
npm test
npm run verify
```
