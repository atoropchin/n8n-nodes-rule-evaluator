# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-14

### Added

- Initial public release of `Rule Evaluator` n8n community node.
- Business-rule evaluation with fixed decision priority ladder.
- Support for decision outcomes: `allow`, `escalate`, `silent`, `deny`, `error`.
- Configurable output field for final decision (default `_decision`).
- Optional matched-rules debug output via `includeMatchedRules`.
