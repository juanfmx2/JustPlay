## Summary

- Requirement ID(s):
- Use-Case ID(s):
- Scope:

## Planning And Traceability Checklist

- [ ] Requirement and use-case IDs are linked.
- [ ] Design note exists before implementation.
- [ ] Design docs were updated when implementation changed scope.
- [ ] Work is split into testable, merge-safe increments.

## Build And Security Checklist

- [ ] Build duration is within target budget.
- [ ] Dependencies use trusted sources and stable releases.
- [ ] Lockfile changes are intentional and reviewed.
- [ ] High/critical vulnerabilities are fixed or explicitly accepted with rationale.

## Coding Standards Checklist

- [ ] Function/module size guidance is respected.
- [ ] Repeated logic is extracted into shared modules/utilities.
- [ ] TypeScript type placement follows project standards.
- [ ] Unit tests are added/updated for new or changed behavior.

## Frontend Quality Checklist

- [ ] Reusable CSS tokens/primitives are used before page-specific styles.
- [ ] UX is verified on smartphones and large screens.
- [ ] Light, dark, and system themes are verified.
- [ ] Accessibility checks include semantics, keyboard support, and contrast.
- [ ] Base palette tokens preserve contrast across supported themes.

## Test Evidence Checklist

- [ ] Lint passed
- [ ] Typecheck passed
- [ ] Unit tests passed
- [ ] Integration/E2E tests updated when applicable
- [ ] Regression tests added when fixing a bug
- [ ] Test evidence is attached (logs/screenshots/summary)

## Risk Assessment

- Risk level: low/medium/high
- Main risks:

## Rollback Plan

- How to revert safely:

## Observability

- Logging/metrics/tracing impact:
- Alerts or dashboards updated: yes/no

## References

- Testing strategy checklists: [docs/testing-strategy.md](docs/testing-strategy.md#quality-checklists)
- Iterative design workflow: [docs/iterative-design-workflow.md](docs/iterative-design-workflow.md#pull-request-checklist)
- Engineering standards: [docs/engineering-standards.md](docs/engineering-standards.md)
