# Testing Strategy

## Test Pyramid
- Unit tests for domain logic and utility behavior.
- Integration tests for boundaries and contracts.
- End-to-end tests only for critical user flows.

## Rules
- New behavior requires unit coverage.
- Changed behavior requires test updates.
- Production defects require regression tests.
- Keep tests fast, deterministic, and isolated.

## CI Expectations
- Pull requests must pass lint, typecheck, and tests.
- Test failures block merges.
- Build and test duration are monitored for regressions.

## Quality Checklists

Use these checklists in pull requests to verify all defined standards, not only test execution.

### Planning And Traceability Checklist
- Requirement ID and Use-Case ID are linked.
- Design note exists before implementation.
- Design docs were updated when implementation changed scope.
- Work is split into testable, merge-safe increments.

### Build And Security Checklist
- Build duration is within current target budget.
- Dependencies come from trusted sources and stable releases.
- Lockfile changes are intentional and reviewed.
- High/critical vulnerability findings are addressed or explicitly accepted with rationale.

### Coding Standards Checklist
- New code follows module/function size guidance.
- Repeated logic is extracted into shared modules/utilities.
- TypeScript types follow local-vs-shared placement rules.
- Unit tests are added or updated for new/changed behavior.

### Frontend Quality Checklist
- Reusable CSS tokens/primitives are used before page-specific styles.
- UX is verified on smartphones and large screens.
- Light, dark, and system theme modes are validated.
- Accessibility checks cover semantics, keyboard navigation, and contrast.
- Base palette tokens preserve strong contrast for all supported themes.

### Test Evidence Checklist
- Unit and integration test scope is clear.
- Regression tests exist for fixed production defects.
- Test runs are deterministic and repeatable.
- Pull request includes concise test evidence and risk notes.
