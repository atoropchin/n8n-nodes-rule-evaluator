# n8n-nodes-rule-evaluator

[English](../README.md) | [Русский](./README.ru.md) | [Español](./README.es.md) | 中文

[npm version](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[npm downloads](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[License: MIT](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

> 把工作流规则集中在一个节点里——策略只在一处维护。

**n8n-nodes-rule-evaluator** 是用于确定性业务规则决策的 n8n 社区节点包。

对每个输入 item，它会评估规则条件，通过固定优先级策略（`Business Rules`）或表命中策略（`Decision Table`）解决冲突，并将 item 路由到解析后的结果。

## 前后对比

**之前**——策略散落在画布各处：

```
[Trigger] -> [IF ...] -> [IF ...] -> [Switch] -> ...
                |            |
                v            v
             [IF ...]    [Merge] -> ...
```

**之后**——规则集中在一个节点：

```
[Trigger] -> [Business Rules] -> (Allow / Escalate / Deny / ...)
```

相同的 item、相同的输入；策略变更时只需改一处。

## 15 秒上手

1. 将 **Business Rules** 或 **Decision Table** 拖到画布上。
2. 用 n8n 原生条件 UI 添加规则/案例。
3. 连接输出——路由已内置。

## 你能得到什么

- **一个节点承载多条规则**——所有策略集中管理。
- **内置路由**——标准结果无需额外 `Switch`。
- **两种决策模式**：
  - **Business Rules**（带优先级阶梯的枚举结果）
  - **Decision Table**（无需 Switch 的表路由与命中策略）
- **兼容旧版**——**Rule Enricher** 供现有工作流使用。

## 包内节点

- **Business Rules**：对每个 item 评估独立规则，按固定优先级阶梯解决冲突，并路由到解析后的结果。
- **Decision Table**：无需 Switch 的表路由，支持自定义字符串决策及四种命中策略：`Unique`、`First`、`Unanimous`、`Collect`。
- **Rule Enricher**：旧版辅助节点，将决策写入字段（默认 `_decision`）；路由需自行添加 `Switch`。

## 该用哪个节点？


|     | Business Rules                             | Decision Table       |
| --- | ------------------------------------------ | -------------------- |
| 结构  | 独立规则                                       | 表行（案例）               |
| 重叠  | 多条规则可同时命中                                  | 案例通常互斥               |
| 结果  | `allow`、`escalate`、`silent`、`deny`、`error` | 自定义字符串决策             |
| 路由  | 按解析后的枚举结果输出路由                              | 按命中策略的无需 Switch 动态输出 |


不确定？从 **Business Rules** 开始。

### Business Rules

适用于 **多条独立检查**（可同时为真）且需要 **一个最终决策** 的场景。

决策优先级（从低到高）：

`allow` < `escalate` < `silent` < `deny` < `error`

若规则条件无法求值，结果为 `error`。

### Decision Table

适用于 **按案例组织** 的逻辑：每个案例组合多个条件（AND），映射到 **字符串决策**。

Decision Table 为 **无需 Switch**：根据 `Hit Policy` 暴露动态输出。

命中策略（`1.2.x` 均可用）：

- `Unique`（默认）：无匹配 → 默认值，单匹配 → 案例决策，2+ 匹配 → 运行时错误
- `First`：首个匹配案例胜出（自上而下按行顺序）
- `Unanimous`：所有匹配案例必须一致（否则运行时错误）
- `Collect`：将所有匹配案例的决策收集为数组，并路由到单一 `decision` 输出

## 快速开始

查看 [工作流示例](./examples.md)，可直接导入 n8n 画布。

### 试用 Business Rules

构建带内置路由的聊天门禁——无需在每次回复前串联 IF。

1. 添加 **When chat message received**，再添加 **Business Rules**。
2. 添加 Rule 1：`risk_score >= 80` → `deny`
3. 添加 Rule 2：`is_suspicious = true` → `escalate`
4. 将 **Default Decision** 设为 `allow`
5. 连接输出：
  - **Allow** → **Answer**（Send Message）
  - **Escalate** → **Request Approval**（Send and Wait）→ 人工审批
  - **Deny** → **Not Permitted**（Send Message）
6. 用 `{ "risk_score": 50, "is_suspicious": true }` 运行 → item 从 **Escalate** 流出（人工审核）。

```
[When chat message received] -> [Business Rules] -- Allow -----> [Answer]
                                    |-- Escalate -> [Request Approval] -> ...
                                    +-- Deny -----> [Not Permitted]
```

### 试用 Decision Table

1. 添加 **Decision Table** 节点。
2. 添加 Case 1：`status = "pending"` AND `days_open > 7` → `escalate`
3. 添加 Case 2：`status = "pending"` → `wait`
4. 将 **Default Decision** 设为 `closed`
5. 将 **Hit Policy** 设为 `First`（多案例命中时取最上方一行）。
6. 连接输出并用 `{ "status": "pending", "days_open": 10 }` 运行 → item 以 `escalate` 流出。

两个案例都命中，但 `First` 选择 Case 1，因为它在 Case 2 之上。无需代码，使用 n8n 原生条件 UI。

案例重叠且顺序重要时用 `First`；需要冲突检测时用 `Unanimous`。

## 参考

**安装**

**n8n UI**

1. Settings → Community Nodes → Install
2. 包名：`n8n-nodes-rule-evaluator`
3. 按提示重启 n8n

**npm / Docker**

```bash
npm install n8n-nodes-rule-evaluator
```

安装后重启 n8n。

**Business Rules 参数**


| 参数                    | 说明                                                       |
| --------------------- | -------------------------------------------------------- |
| Default Decision      | 可选：`allow`、`escalate`、`silent`、`deny`、`error`。默认：`deny`。 |
| Rules                 | 固定集合。每条规则：一个 IF 风格条件和一个 **Decision**。                    |
| Output Field Name     | 写入 JSON 的字段。默认：`_decision`。                              |
| Include Matched Rules | 添加 `matched_rules` 用于调试（ruleIndex 与 decision）。           |


**Decision Table 参数**


| 参数                   | 说明                                                        |
| -------------------- | --------------------------------------------------------- |
| Default Decision     | 无案例匹配时使用。                                                 |
| Cases                | 每个案例：多个条件（AND）及自定义字符串 **Decision**。                       |
| Hit Policy           | `Unique` / `First` / `Unanimous` / `Collect`。默认：`Unique`。 |
| Output Field Name    | 默认：`_decision`。                                           |
| Include Matched Case | 调试：哪个案例命中。                                                |


`**{Output Field Name}` 的输出类型**：

- `Unique` / `First` / `Unanimous`：`string`
- `Collect`：`string[]`（按案例顺序排列的命中决策数组）

**Rule Enricher（旧版）**

已弃用，但仍支持现有工作流。

将解析后的决策写入配置的输出字段（默认 `_decision`）；路由需添加 `Switch` 节点。

新工作流应使用 **Business Rules**。

### 输出示例

```json
{
  "message": "Can you help with my order?",
  "is_suspicious": true,
  "risk_score": 50,
  "_decision": "escalate"
}
```

### 兼容性

- **需要 n8n >= 1.0.0**（使用现代 Condition UI）。
- 任何启用 community nodes 的 n8n 实例，无需 credentials。
- `1.2.x` 包范围：**Decision Table**、**Business Rules** 和 **Rule Enricher**（旧版）。
- 每个输入 item 对应一个输出 item；**Business Rules** 将每个 item 路由到恰好一个动态输出。

### 故障排查

- 意外的 `error`：检查表达式与映射字段；无法求值的条件会得到 `error`。
- 无匹配：核对输入字段与 **Default Decision**。
- 调试可见性：启用 **Include Matched Rules** / **Include Matched Case**。

**测试与开发**

```bash
npm test
npm run verify
```

