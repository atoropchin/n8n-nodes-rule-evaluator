# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-06-10

### Added

- New `Decision Table` node with switchless dynamic routing and user-defined decision strings.
- Four hit policies in one release: `Unique` (default), `First`, `Unanimous`, `Collect`.
- Decision-table engine layer in `lib/decision-table/` with policy registry and pure evaluators.
- Shared runtime helpers in `lib/shared/` for filter evaluation, output-item construction, and safe errors.
- `decision-table.test.mjs` suite for hit policies, dynamic outputs, parity checks, fallback behavior, and continue-on-fail coverage.
- New `decision-table.svg` icon and package registration for `DecisionTable.node`.

### Changed

- Package version bumped to `1.2.0`.
- Dynamic-output scope guard now allows Decision Table references starting from `1.2.x`.
- Build and formatting configuration now includes `nodes/DecisionTable/**` and `lib/**`.
- README and translated docs (RU/ES/ZH) now document the three-node lineup and when to choose each node.

## [1.1.0] - 2026-06-04

### Added

- New `Business Rules` node with switchless routing using dynamic outputs.
- Dynamic output visibility based on configured decisions (`defaultDecision` + rule decisions).
- Deterministic output ordering: `allow`, `escalate`, `silent`, `deny`, `error`.
- Dedicated `business-rules.test.mjs` test suite plus RE/BR parity vectors.

### Changed

- Renamed legacy `ruleEvaluator` UI to `Rule Enricher` and marked it as deprecated.
- Removed conflicting legacy `Business Rules` codex alias from `ruleEvaluator`.
- Updated README for two-node model (`Business Rules` recommended, `Rule Enricher` legacy).
- Added README translations (Russian, Spanish, Chinese) in `docs/`.
- Added explicit `1.1.x` package-scope guard in CI to keep release scope limited to current nodes.
- Explicitly separated `Business Rules` and `Rule Enricher` codebases; no shared runtime layer is planned.
- Declared `Rule Enricher` as maintenance-only legacy compatibility node (no new feature development planned).

## [1.0.0] - 2026-05-14

### Added

- Initial public release of `Rule Evaluator` n8n community node.
- Business-rule evaluation with fixed decision priority ladder.
- Support for decision outcomes: `allow`, `escalate`, `silent`, `deny`, `error`.
- Configurable output field for final decision (default `_decision`).
- Optional matched-rules debug output via `includeMatchedRules`.

