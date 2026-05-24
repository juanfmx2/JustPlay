---
description: "Testing strategy rules for test quality and reliability"
applyTo: "**/*.{test,spec}.{ts,tsx,js,jsx}"
---

# Testing Rules

- Test behavior and outcomes, not private implementation details.
- Keep tests deterministic and isolated.
- Prefer fast tests with clear setup and teardown boundaries.
- Add regression tests for every production bug fix.

# Canonical References

- Test rules and pyramid: [docs/testing-strategy.md](../../docs/testing-strategy.md#test-pyramid)
- Iterative delivery checklist: [docs/iterative-design-workflow.md](../../docs/iterative-design-workflow.md#pull-request-checklist)
- Requirement and use-case tracking: [docs/requirements-and-use-cases.md](../../docs/requirements-and-use-cases.md#usage-rules)
