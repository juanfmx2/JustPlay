---
description: "Frontend implementation rules for maintainable UI, accessibility, and performance"
applyTo: "apps/web/**"
---

# Frontend Rules

- Keep components focused and composable.
- Prefer presentational components plus hooks for logic reuse.
- Keep state local by default and elevate only when necessary.
- Validate user input before submit and handle API errors clearly.
- Keep pages responsive and accessible.
- Add tests for new UI behavior and interaction logic.

# Design Iteration

- Implement from approved design notes and use-case criteria.
- If implementation needs design changes, update design docs in the same branch.

# Canonical References

- Product mission and principles: [docs/vision.md](../../docs/vision.md#product-principles)
- Engineering and TypeScript standards: [docs/engineering-standards.md](../../docs/engineering-standards.md#coding-standards)
- Iterative design flow: [docs/iterative-design-workflow.md](../../docs/iterative-design-workflow.md#workflow)
- Testing strategy: [docs/testing-strategy.md](../../docs/testing-strategy.md#rules)
