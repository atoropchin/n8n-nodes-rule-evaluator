# n8n-nodes-rule-evaluator

[English](../README.md) | [Русский](./README.ru.md) | Español | [中文](./README.zh.md)

[![npm version](https://img.shields.io/npm/v/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![npm downloads](https://img.shields.io/npm/dw/n8n-nodes-rule-evaluator.svg)](https://www.npmjs.com/package/n8n-nodes-rule-evaluator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/atoropchin/n8n-nodes-rule-evaluator/blob/main/LICENSE)

> Pon las reglas del workflow en un solo nodo: un único lugar para editar políticas.

**n8n-nodes-rule-evaluator** es un paquete de nodos community de n8n para decisiones deterministas basadas en reglas de negocio.

Para cada item de entrada evalúa las condiciones de las reglas, resuelve conflictos con una estrategia de prioridad fija (`Business Rules`) o una política de impacto de tabla (`Decision Table`), y enruta el item al resultado resuelto.

## Antes y después

**Antes** — políticas dispersas por el canvas:

```
[Trigger] -> [IF ...] -> [IF ...] -> [Switch] -> ...
                |            |
                v            v
             [IF ...]    [Merge] -> ...
```

**Después** — reglas consolidadas en un solo nodo:

```
[Trigger] -> [Business Rules] -> (Allow / Escalate / Deny / ...)
```

Mismo item, mismas entradas; un solo lugar para editar cuando cambian las políticas.

## En 15 segundos

1. Arrastra **Business Rules** o **Decision Table** al canvas.
2. Añade reglas/casos con la UI nativa de condiciones de n8n.
3. Conecta las salidas — el enrutamiento ya está integrado.

## Qué obtienes

- **Un nodo para muchas reglas** — todas las políticas en un solo lugar.
- **Enrutamiento integrado** — sin `Switch` extra para resultados estándar.
- **Dos patrones de decisión**:
  - **Business Rules** (resultados enum con escalera de prioridad)
  - **Decision Table** (enrutamiento tabular switchless con políticas de impacto)
- **Compatibilidad legacy** — **Rule Enricher** para workflows existentes.

## Nodos del paquete

- **Business Rules**: evalúa reglas independientes por item, resuelve conflictos con una escalera de prioridad fija y enruta al resultado resuelto.
- **Decision Table**: enrutamiento tabular switchless con decisiones de texto definidas por el usuario y cuatro políticas de impacto: `Unique`, `First`, `Unanimous`, `Collect`.
- **Rule Enricher**: ayudante legacy que escribe la decisión en un campo (por defecto `_decision`); añades un `Switch` para enrutar.

## ¿Qué nodo debo usar?


|              | Business Rules                                 | Decision Table                                |
| ------------ | ---------------------------------------------- | --------------------------------------------- |
| Forma        | Reglas independientes                          | Filas de tabla (casos)                        |
| Solapamiento | Varias reglas pueden coincidir                 | Los casos suelen ser mutuamente excluyentes   |
| Resultados   | `allow`, `escalate`, `silent`, `deny`, `error` | Tus propias decisiones de texto               |
| Enrutamiento | Por resultado enum resuelto                    | Salidas dinámicas switchless según hit policy |


¿No estás seguro? Empieza con **Business Rules**.

### Business Rules

Úsalo cuando tienes **muchas comprobaciones independientes** (varias pueden ser verdaderas a la vez) y necesitas **una decisión final**.

Prioridad de decisiones (baja → alta):

`allow` < `escalate` < `silent` < `deny` < `error`

Si una condición de regla no se puede evaluar, el resultado es `error`.

### Decision Table

Úsalo cuando tu lógica es **por casos**: cada caso combina varias condiciones (AND) y se asigna a una **decisión de texto**.

Decision Table es **switchless**: expone salidas dinámicas según `Hit Policy`.

Políticas de impacto (todas disponibles en `1.2.x`):

- `Unique` (por defecto): sin coincidencia → default, una coincidencia → decisión del caso, 2+ coincidencias → error en tiempo de ejecución
- `First`: gana el primer caso coincidente (orden de filas de arriba a abajo)
- `Unanimous`: todos los casos coincidentes deben coincidir (si no, error en tiempo de ejecución)
- `Collect`: reúne todas las decisiones de casos coincidentes en un arreglo y enruta a una sola salida `decision`

## Inicio rápido

Consulta nuestros [ejemplos de workflow](./examples.md) para importarlos directamente en tu canvas de n8n.

### Prueba Business Rules

Construye un filtro de chat con enrutamiento integrado — sin cadena de IF antes de cada respuesta.

1. Añade **When chat message received**, luego **Business Rules**.
2. Añade Rule 1: `risk_score >= 80` → `deny`
3. Añade Rule 2: `is_suspicious = true` → `escalate`
4. Configura **Default Decision** en `allow`
5. Conecta las salidas:
  - **Allow** → **Answer** (Send Message)
  - **Escalate** → **Request Approval** (Send and Wait) → aprobación humana
  - **Deny** → **Not Permitted** (Send Message)
6. Ejecuta con `{ "risk_score": 50, "is_suspicious": true }` → el item sale por **Escalate** (revisión humana).

```
[When chat message received] -> [Business Rules] -- Allow -----> [Answer]
                                    |-- Escalate -> [Request Approval] -> ...
                                    +-- Deny -----> [Not Permitted]
```

### Prueba Decision Table

1. Añade el nodo **Decision Table**.
2. Añade Case 1: `status = "pending"` AND `days_open > 7` → `escalate`
3. Añade Case 2: `status = "pending"` → `wait`
4. Configura **Default Decision** en `closed`
5. Configura **Hit Policy** en `First` (la fila superior gana cuando varios casos coinciden).
6. Conecta las salidas y ejecuta con `{ "status": "pending", "days_open": 10 }` → el item sale como `escalate`.

Ambos casos coinciden, pero `First` elige Case 1 porque está por encima de Case 2. Sin código. UI nativa de condiciones de n8n.

Para casos solapados donde importa el orden, usa `First`. Para detectar conflictos, usa `Unanimous`.

## Referencia

**Instalación**

**UI de n8n**

1. Settings → Community Nodes → Install
2. Nombre del paquete: `n8n-nodes-rule-evaluator`
3. Reinicia n8n si se solicita

**npm / Docker**

```bash
npm install n8n-nodes-rule-evaluator
```

Reinicia n8n tras la instalación.

**Parámetros de Business Rules**


| Parámetro             | Descripción                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| Default Decision      | Uno de: `allow`, `escalate`, `silent`, `deny`, `error`. Por defecto: `deny`. |
| Rules                 | Colección fija. Cada regla: una condición estilo IF y una **Decision**.      |
| Output Field Name     | Campo escrito en JSON. Por defecto: `_decision`.                             |
| Include Matched Rules | Añade `matched_rules` para depuración (ruleIndex y decision).                |


**Parámetros de Decision Table**


| Parámetro            | Descripción                                                                    |
| -------------------- | ------------------------------------------------------------------------------ |
| Default Decision     | Se usa cuando ningún caso coincide.                                            |
| Cases                | Cada caso: varias condiciones (AND) y una **Decision** de texto personalizada. |
| Hit Policy           | `Unique` / `First` / `Unanimous` / `Collect`. Por defecto: `Unique`.           |
| Output Field Name    | Por defecto: `_decision`.                                                      |
| Include Matched Case | Depuración: qué caso coincidió.                                                |


**Tipo de salida para `{Output Field Name}`**:

- `Unique` / `First` / `Unanimous`: `string`
- `Collect`: `string[]` (arreglo de decisiones coincidentes en orden de casos)

**Rule Enricher (legacy)**

Obsoleto pero compatible con workflows existentes.

Escribe la decisión resuelta en el campo de salida configurado (por defecto `_decision`); añades un nodo `Switch` para enrutar.

Los workflows nuevos deben usar **Business Rules**.

### Ejemplo de salida

```json
{
  "message": "Can you help with my order?",
  "is_suspicious": true,
  "risk_score": 50,
  "_decision": "escalate"
}
```

### Compatibilidad

- **Requiere n8n >= 1.0.0** (usa la Condition UI moderna).
- Cualquier instancia n8n con community nodes habilitados. No requiere credenciales.
- Alcance del paquete para `1.2.x`: **Decision Table**, **Business Rules** y **Rule Enricher** (legacy).
- Un item de salida por item de entrada; **Business Rules** enruta cada item a exactamente una salida dinámica.

### Solución de problemas

- `error` inesperado: revisa expresiones y campos mapeados; condiciones no evaluables → `error`.
- Sin coincidencias: verifica campos de entrada y **Default Decision**.
- Visibilidad de depuración: activa **Include Matched Rules** / **Include Matched Case**.

**Pruebas y desarrollo**

```bash
npm test
npm run verify
```

