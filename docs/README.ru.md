# n8n-nodes-rule-evaluator

[English](../README.md) | Русский | [Español](./README.es.md) | [中文](./README.zh.md)

[![npm version](https://img.shields.io/npm/v/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![npm downloads](https://img.shields.io/npm/dw/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

**n8n-nodes-rule-evaluator** — community-пакет n8n для детерминированных решений по бизнес-правилам.

Для каждого item оцениваются несколько правил через встроенный UI условий n8n, конфликты разрешаются по фиксированной лестнице приоритетов, итоговое решение записывается в JSON item.

## Ноды в пакете

| Нода | Назначение |
|------|------------|
| **Business Rules** | Рекомендуется. Оценивает правила и маршрутизирует items через динамические выходы (без внешнего `Switch`). |
| **Rule Enricher** | Legacy. Записывает решение в настраиваемое поле (по умолчанию `_decision`); для маршрутизации нужен `Switch`. |

## Быстрый старт

1. Установите `n8n-nodes-rule-evaluator`.
2. Новые workflow — **Business Rules**. Существующие — **Rule Enricher** и `Switch` по полю результата.
3. Задайте **Default Decision** — fallback, если ничего не совпало.
4. Добавьте правила через **Add Rule** (одно IF-условие на правило).
5. **Output Field Name** — `_decision` или своё имя.

Пример:

- Правило 1: `amount > 500` → `allow`
- Правило 2: `amount > 1000` → `silent`
- Default Decision: `deny`

При `amount = 1200` результат — `silent` (см. [Приоритет решений](#приоритет-решений)).

## Как это работает

Для каждого входного item:

1. Вычислить все условия правил (UI условий n8n в стиле IF).
2. Собрать решения совпавших правил.
3. Выбрать совпадение с наивысшим приоритетом (см. ниже).
4. Если совпадений нет — **Default Decision**.
5. Записать результат в **Output Field Name** (и маршрутизировать в **Business Rules**).

**Rule Enricher** — один выходной поток. **Business Rules** — та же логика, но item уходит на динамический выход (`Allow`, `Deny` и т.д.).

## Приоритет решений

При нескольких совпадениях (от низкого к высокому):

`allow` < `escalate` < `silent` < `deny` < `error`

Например: `silent` перекрывает `allow`; `deny` — `silent`; `error` — всё.

Ошибка вычисления условия → решение `error`.

## Установка

### Через UI n8n

1. **Settings** → **Community Nodes** → **Install**
2. Имя пакета: `n8n-nodes-rule-evaluator`
3. Подтвердите и перезапустите n8n при необходимости.

### npm / Docker

```bash
npm install n8n-nodes-rule-evaluator
```

Перезапустите n8n.

## Параметры ноды

### Default Decision

- Значения: `allow`, `escalate`, `silent`, `deny`, `error`
- По умолчанию: `deny`
- Когда ни одно правило не совпало

### Business Rules (коллекция)

- Fixed collection с **Add Rule**
- Каждое правило: одно IF-условие и **Decision**

### Options

- **Output Field Name** — по умолчанию `_decision`
- **Include Matched Rules** — `matched_rules` с `ruleIndex` (с 1) и `decision`

## Примеры вывода

### Базовый

```json
{
  "sender_id": "ivan",
  "amount": 1200,
  "_decision": "silent"
}
```

Правила: `amount > 500` → `allow`, `amount > 1000` → `silent`.

### С matched rules

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

### Без совпадений

```json
{
  "sender_id": "ivan",
  "amount": 100,
  "_decision": "deny"
}
```

(Default Decision был `deny`.)

## Совместимость

- Нужна инстанция n8n с community nodes. Credentials не требуются.
- В `1.1.x` только **Business Rules** и **Rule Enricher**.
- **Rule Enricher** deprecated, сохранён для совместимости; для новых workflow — **Business Rules**.
- Один выходной item на входной; **Business Rules** отправляет item ровно на один динамический выход.

## Отладка

- Неожиданный `error` — проверьте выражения и поля; невычислимые условия дают `error`.
- Нет совпадений — данные item и **Default Decision**.
- Включите **Include Matched Rules** для детальной отладки.

## Разработка

```bash
npm test
npm run verify
```
