# n8n-nodes-rule-evaluator

[English](../README.md) | [Русский](./README.ru.md) | Español | [中文](./README.zh.md)

[![npm version](https://img.shields.io/npm/v/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![npm downloads](https://img.shields.io/npm/dw/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

**n8n-nodes-rule-evaluator** es un paquete de nodos community de n8n para decisiones deterministas basadas en reglas de negocio.

Para cada item evalúa varias reglas con la UI nativa de condiciones de n8n, resuelve conflictos con una escalera de prioridad fija y escribe una decisión final en el JSON de salida.

## Nodos del paquete

| Nodo | Función |
|------|---------|
| **Business Rules** | Recomendado. Evalúa reglas y enruta cada item por salidas dinámicas (sin `Switch` externo). |
| **Rule Enricher** | Legacy. Escribe la decisión en un campo configurable (por defecto `_decision`); añade un `Switch` para enrutar. |

## Inicio rápido

1. Instala `n8n-nodes-rule-evaluator`.
2. Workflows nuevos: **Business Rules**. Existentes: **Rule Enricher** y un `Switch` sobre el campo de salida.
3. Configura **Default Decision** cuando ninguna regla coincide.
4. Añade reglas con **Add Rule** (una condición estilo IF por regla).
5. **Output Field Name**: `_decision` u otro nombre.

Ejemplo:

- Regla 1: `amount > 500` → `allow`
- Regla 2: `amount > 1000` → `silent`
- Default Decision: `deny`

Con `amount = 1200`, el resultado es `silent` (véase [Prioridad de decisiones](#prioridad-de-decisiones)).

## Cómo funciona

Para cada item de entrada:

1. Evaluar todas las condiciones (UI estilo IF de n8n).
2. Recopilar las decisiones coincidentes.
3. Elegir la de mayor prioridad (abajo).
4. Si no hay coincidencias, usar **Default Decision**.
5. Escribir el resultado en **Output Field Name** (y enrutar en **Business Rules**).

**Rule Enricher** mantiene un solo flujo de salida. **Business Rules** usa la misma lógica pero envía cada item a una salida dinámica (`Allow`, `Deny`, etc.).

## Prioridad de decisiones

Varias reglas coinciden (de menor a mayor):

`allow` < `escalate` < `silent` < `deny` < `error`

Ejemplos: `silent` prevalece sobre `allow`; `deny` sobre `silent`; `error` sobre todo.

Si una condición no se puede evaluar, la decisión es `error`.

## Instalación

### UI de n8n

1. **Settings** → **Community Nodes** → **Install**
2. Nombre del paquete: `n8n-nodes-rule-evaluator`
3. Confirma e reinicia n8n si es necesario.

### npm / Docker

```bash
npm install n8n-nodes-rule-evaluator
```

Reinicia n8n.

## Parámetros

### Default Decision

- Valores: `allow`, `escalate`, `silent`, `deny`, `error`
- Por defecto: `deny`
- Cuando ninguna regla coincide

### Business Rules (colección)

- Colección fija con **Add Rule**
- Cada regla: una condición IF y una **Decision**

### Options

- **Output Field Name** — por defecto `_decision`
- **Include Matched Rules** — `matched_rules` con `ruleIndex` (desde 1) y `decision`

## Ejemplos de salida

### Básico

```json
{
  "sender_id": "ivan",
  "amount": 1200,
  "_decision": "silent"
}
```

Reglas: `amount > 500` → `allow`, `amount > 1000` → `silent`.

### Con matched rules

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

### Sin coincidencias

```json
{
  "sender_id": "ivan",
  "amount": 100,
  "_decision": "deny"
}
```

(Default Decision era `deny`.)

## Compatibilidad

- Requiere instancia n8n con community nodes habilitados. No requiere credenciales.
- En `1.1.x`: solo **Business Rules** y **Rule Enricher**.
- **Rule Enricher** está deprecated pero se mantiene; usa **Business Rules** en workflows nuevos.
- Un item de salida por item de entrada; **Business Rules** enruta cada item a exactamente una salida dinámica.

## Solución de problemas

- **`error` inesperado**: revisa expresiones y campos; condiciones no evaluables → `error`.
- **Sin coincidencias**: verifica datos del item y **Default Decision**.
- **Depuración**: activa **Include Matched Rules**.

## Desarrollo

```bash
npm test
npm run verify
```
