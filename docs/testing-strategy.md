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
