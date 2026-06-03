# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
