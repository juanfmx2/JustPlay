---
description: "Testing strategy rules for unit tests, coverage quality, and merge safety"
applyTo: "**/*.{test,spec}.{ts,tsx,js,jsx}"
---

# Testing Rules

- New code requires new or updated unit tests.
- Test behavior and outcomes, not private implementation details.
- Keep tests deterministic and isolated.
- Prefer fast tests with clear setup and teardown boundaries.
- Add regression tests for every production bug fix.

# Merge Safety

- Pull requests are not ready unless tests pass in CI.
- Include concise test evidence in pull request description.

# Canonical References

- Test rules and pyramid: [docs/testing-strategy.md](../../docs/testing-strategy.md#test-pyramid)
- Iterative delivery checklist: [docs/iterative-design-workflow.md](../../docs/iterative-design-workflow.md#pull-request-checklist)
- Requirement and use-case tracking: [docs/requirements-and-use-cases.md](../../docs/requirements-and-use-cases.md#usage-rules)
