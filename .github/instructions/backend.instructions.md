---
description: "Backend architecture and service implementation rules for API and domain logic"
applyTo: "apps/api/**"
---

# Backend Rules

- Keep endpoints thin and move business logic into service/domain modules.
- Validate request payloads and query params at the boundary.
- Keep modules focused by feature and responsibility.
- Prefer explicit transactional boundaries for multi-write operations.
- Propagate typed domain errors, not raw infrastructure errors.
- Add unit tests for domain logic and integration tests for endpoint wiring when added.

# Security

- Enforce authentication and authorization checks explicitly.
- Use least-privilege data access.
- Avoid leaking internal errors to clients.
- Log security-relevant events with sanitized context.

# Canonical References

- Engineering and security baseline: [docs/engineering-standards.md](../../docs/engineering-standards.md#security-baseline)
- Coding and type strategy: [docs/engineering-standards.md](../../docs/engineering-standards.md#typescript-type-strategy)
- Iterative design flow: [docs/iterative-design-workflow.md](../../docs/iterative-design-workflow.md#workflow)
- Testing strategy: [docs/testing-strategy.md](../../docs/testing-strategy.md#rules)
