# n8n-nodes-rule-evaluator

[English](../README.md) | Русский | [Español](./README.es.md) | [中文](./README.zh.md)

[npm version](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[npm downloads](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[License: MIT](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

> Все правила workflow — в одной ноде: одно место для редактирования политик.

**n8n-nodes-rule-evaluator** — community-пакет n8n для детерминированных решений по бизнес-правилам.

Для каждого входного item оцениваются условия правил, конфликты разрешаются по фиксированной стратегии приоритетов (`Business Rules`) или по hit policy таблицы (`Decision Table`), и item маршрутизируется к итоговому результату.

## До и после

**До** — политики разбросаны по canvas:

```
[Trigger] -> [IF ...] -> [IF ...] -> [Switch] -> ...
                |            |
                v            v
             [IF ...]    [Merge] -> ...
```

**После** — правила собраны в одной ноде:

```
[Trigger] -> [Business Rules] -> (Allow / Escalate / Deny / ...)
```

Тот же item, те же входные данные; одно место для правок при изменении политик.

## За 15 секунд

1. Перетащите **Business Rules** или **Decision Table** на canvas.
2. Добавьте правила/кейсы через нативный UI условий n8n.
3. Подключите выходы — маршрутизация встроена.

## Что вы получаете

- **Одна нода для многих правил** — все политики в одном месте.
- **Встроенная маршрутизация** — без лишнего `Switch` для стандартных исходов.
- **Два паттерна принятия решений**:
  - **Business Rules** (enum-исходы с лестницей приоритетов)
  - **Decision Table** (switchless-таблица с hit policy)
- **Совместимость с legacy** — **Rule Enricher** для существующих workflow.

## Ноды в пакете

- **Business Rules**: оценивает независимые правила для каждого item, разрешает конфликты по фиксированной лестнице приоритетов и маршрутизирует к итоговому исходу.
- **Decision Table**: switchless-табличная маршрутизация с пользовательскими строковыми решениями и четырьмя hit policy: `Unique`, `First`, `Unanimous`, `Collect`.
- **Rule Enricher**: legacy-хелпер, записывает решение в поле (по умолчанию `_decision`); для маршрутизации добавляете `Switch`.

## Какую ноду выбрать?


|               | Business Rules                                 | Decision Table                               |
| ------------- | ---------------------------------------------- | -------------------------------------------- |
| Форма         | Независимые правила                            | Строки таблицы (кейсы)                       |
| Пересечения   | Несколько правил могут совпасть                | Кейсы обычно взаимоисключающие               |
| Исходы        | `allow`, `escalate`, `silent`, `deny`, `error` | Ваши собственные строковые решения           |
| Маршрутизация | По разрешённому enum-исходу                    | Switchless-динамические выходы по hit policy |


Не уверены? Начните с **Business Rules**.

### Business Rules

Используйте, когда есть **много независимых проверок** (несколько могут быть истинны одновременно) и нужно **одно финальное решение**.

Приоритет решений (от низкого к высокому):

`allow` < `escalate` < `silent` < `deny` < `error`

Если условие правила не удаётся вычислить, исход — `error`.

### Decision Table

Используйте, когда логика **кейсовая**: каждый кейс объединяет несколько условий (AND) и сопоставляется со **строковым решением**.

Decision Table — **switchless**: динамические выходы зависят от `Hit Policy`.

Hit policy (все доступны в `1.2.x`):

- `Unique` (по умолчанию): нет совпадений → default, одно совпадение → решение кейса, 2+ совпадений → runtime error
- `First`: побеждает первый совпавший кейс (сверху вниз по порядку строк)
- `Unanimous`: все совпавшие кейсы должны согласоваться (иначе runtime error)
- `Collect`: собирает все решения совпавших кейсов в массив и маршрутизирует на один выход `decision`

## Быстрый старт

Смотрите [примеры workflow](./examples.md) — их можно импортировать прямо в canvas n8n.

### Попробуйте Business Rules

Соберите chat gate со встроенной маршрутизацией — без цепочки IF перед каждым ответом.

1. Добавьте **When chat message received**, затем **Business Rules**.
2. Добавьте Rule 1: `risk_score >= 80` → `deny`
3. Добавьте Rule 2: `is_suspicious = true` → `escalate`
4. Установите **Default Decision** в `allow`
5. Подключите выходы:
  - **Allow** → **Answer** (Send Message)
  - **Escalate** → **Request Approval** (Send and Wait) → одобрение человеком
  - **Deny** → **Not Permitted** (Send Message)
6. Запустите с `{ "risk_score": 50, "is_suspicious": true }` → item уходит на **Escalate** (проверка человеком).

```
[When chat message received] -> [Business Rules] -- Allow -----> [Answer]
                                    |-- Escalate -> [Request Approval] -> ...
                                    +-- Deny -----> [Not Permitted]
```

### Попробуйте Decision Table

1. Добавьте ноду **Decision Table**.
2. Добавьте Case 1: `status = "pending"` AND `days_open > 7` → `escalate`
3. Добавьте Case 2: `status = "pending"` → `wait`
4. Установите **Default Decision** в `closed`
5. Установите **Hit Policy** в `First` (верхняя строка побеждает при нескольких совпадениях).
6. Подключите выходы и запустите с `{ "status": "pending", "days_open": 10 }` → item уходит как `escalate`.

Оба кейса совпадают, но `First` выбирает Case 1, потому что он выше Case 2. Без кода. Нативный UI условий n8n.

Для пересекающихся кейсов, где важен порядок, используйте `First`. Для обнаружения конфликтов — `Unanimous`.

## Справочник

**Установка**

**UI n8n**

1. Settings → Community Nodes → Install
2. Имя пакета: `n8n-nodes-rule-evaluator`
3. Перезапустите n8n при необходимости

**npm / Docker**

```bash
npm install n8n-nodes-rule-evaluator
```

Перезапустите n8n после установки.

**Параметры Business Rules**


| Параметр              | Описание                                                                       |
| --------------------- | ------------------------------------------------------------------------------ |
| Default Decision      | Одно из: `allow`, `escalate`, `silent`, `deny`, `error`. По умолчанию: `deny`. |
| Rules                 | Fixed collection. Каждое правило: одно IF-условие и **Decision**.              |
| Output Field Name     | Поле, записываемое в JSON. По умолчанию: `_decision`.                          |
| Include Matched Rules | Добавляет `matched_rules` для отладки (ruleIndex и decision).                  |


**Параметры Decision Table**


| Параметр             | Описание                                                                        |
| -------------------- | ------------------------------------------------------------------------------- |
| Default Decision     | Используется, когда ни один кейс не совпал.                                     |
| Cases                | Каждый кейс: несколько условий (AND) и пользовательское строковое **Decision**. |
| Hit Policy           | `Unique` / `First` / `Unanimous` / `Collect`. По умолчанию: `Unique`.           |
| Output Field Name    | По умолчанию: `_decision`.                                                      |
| Include Matched Case | Отладка: какой кейс совпал.                                                     |


**Тип выходного поля `{Output Field Name}`**:

- `Unique` / `First` / `Unanimous`: `string`
- `Collect`: `string[]` (массив совпавших решений в порядке кейсов)

**Rule Enricher (legacy)**

Устарел, но поддерживается для существующих workflow.

Записывает разрешённое решение в настроенное выходное поле (по умолчанию `_decision`); для маршрутизации добавляете ноду `Switch`.

Новые workflow должны использовать **Business Rules**.

### Пример вывода

```json
{
  "message": "Can you help with my order?",
  "is_suspicious": true,
  "risk_score": 50,
  "_decision": "escalate"
}
```

### Совместимость

- **Требуется n8n >= 1.0.0** (используется современный Condition UI).
- Любой инстанс n8n с включёнными community nodes. Credentials не требуются.
- Состав пакета для `1.2.x`: **Decision Table**, **Business Rules** и **Rule Enricher** (legacy).
- Один выходной item на входной; **Business Rules** маршрутизирует каждый item ровно на один динамический выход.

### Отладка

- Неожиданный `error`: проверьте выражения и сопоставленные поля; невычислимые условия дают `error`.
- Нет совпадений: проверьте входные поля и **Default Decision**.
- Видимость для отладки: включите **Include Matched Rules** / **Include Matched Case**.

**Тестирование и разработка**

```bash
npm test
npm run verify
```

