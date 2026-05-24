---
description: "Frontend implementation rules for maintainable UI, accessibility, and performance"
applyTo: "apps/web/**"
---

# Frontend Rules

- Keep components focused and composable.
- Prefer presentational components plus hooks for logic reuse.
- Build reusable CSS utilities/tokens and shared component styles before page-specific styling.
- Keep state local by default and elevate only when necessary.
- Validate user input before submit and handle API errors clearly.
- Ensure responsive behavior for smartphones and large screens.
- Support light, dark, and system themes by default.
- Follow accessibility best practices for semantics, keyboard support, and contrast.

# Canonical References

- Product mission and principles: [docs/vision.md](../../docs/vision.md#product-principles)
- Engineering and TypeScript standards: [docs/engineering-standards.md](../../docs/engineering-standards.md#coding-standards)
- Frontend responsiveness, theming, and accessibility: [docs/engineering-standards.md](../../docs/engineering-standards.md#frontend-standards)
- Iterative design flow: [docs/iterative-design-workflow.md](../../docs/iterative-design-workflow.md#workflow)
- Testing strategy: [docs/testing-strategy.md](../../docs/testing-strategy.md#rules)
