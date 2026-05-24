# Engineering Standards

## Build Performance
- Initial full build target: under 60 seconds.
- Growth budget: under 300 seconds.
- Track build duration in CI and investigate regressions.

## Security Baseline
- Use stable releases from trusted repositories.
- Keep lockfiles committed and deterministic installs enforced.
- Review and apply security updates on biweekly cadence.
- Prioritize high and critical vulnerabilities.
- Validate external input at all service boundaries.

## Coding Standards
- Prefer functions up to 30 lines; 60 hard limit.
- Prefer modules up to 300 lines; 500 lines hard limit.
- Reuse shared logic to avoid duplication.
- Keep files and naming aligned with single responsibility.

## TypeScript Type Strategy
- Local-only types stay close to usage.
- Shared types live in dedicated context modules.
- API contracts are defined near service boundaries.
- Use explicit exports by context rather than ad hoc re-exports.

## Frontend Standards
- Build reusable CSS primitives and component-level styles before creating page-specific overrides.
- Use a mobile-first responsive approach and verify usability on smartphones and large screens.
- Support light, dark, and system theme modes by default.
- Provide accessibility support across interactions, semantics, keyboard navigation, and contrast.
- Define and maintain a base theme palette with color tokens that guarantee strong contrast per theme.

## Testing Baseline
- New code requires unit tests.
- Behavior changes require test updates.
- Bug fixes require regression tests.
