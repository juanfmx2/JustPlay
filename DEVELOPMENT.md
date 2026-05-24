# JustPlay Development Setup

This is a TypeScript-based monorepo for JustPlay, a multi-sport logistics and league management platform.

## Architecture

```
justplay/
├── apps/
│   ├── api/           # Fastify + GraphQL Yoga + Pothos GraphQL server
│   └── web/           # React + Vite + TanStack Router frontend
├── packages/
│   ├── db/            # Drizzle ORM schema and database utilities
│   ├── gql/           # Shared GraphQL type definitions
│   └── auth/          # Better Auth authentication integration
└── docs/              # Product and engineering documentation
```

## Tech Stack

- **Runtime**: Node.js (LTS)
- **Package Manager**: pnpm 10.x
- **Build Orchestration**: Turborepo
- **Language**: TypeScript (strict mode)
- **Backend**: Fastify + GraphQL Yoga + Pothos + Drizzle ORM + PostgreSQL
- **Frontend**: React 18 + Vite + TanStack Router + Capacitor (mobile)
- **Auth**: Better Auth (TypeScript-native, social sign-in, MFA)
- **Testing**: Jest + React Testing Library
- **Linting**: ESLint + TypeScript

## Prerequisites

- **pnpm**: See [pnpm installation](https://pnpm.io/installation)
- **Node.js**: 20.x or higher
- **PostgreSQL**: 14+ (for local development)

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy the environment template and fill in values:

```bash
cp .env.example .env.local
```

### 3. Run Development Servers

Start all development servers (API on :4000, Web on :3000):

```bash
pnpm dev
```

Or run individually:

```bash
# Frontend only
pnpm --filter @justplay/web dev

# Backend only
pnpm --filter @justplay/api dev
```

## Common Commands

All commands run across the monorepo via Turborepo.

```bash
# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test

# Clean build artifacts
pnpm clean
```

## Project Structure

### Frontend (`apps/web`)

- Responsive design: 320px mobile to 1920px desktop
- Theme system: light/dark/system modes with CSS custom properties
- Sticky navigation header with mobile menu
- Built with React hooks and context for state management
- Vite for fast HMR during development

### Backend (`apps/api`)

- GraphQL API via GraphQL Yoga
- Type-safe schema with Pothos
- Fastify for HTTP server
- Better Auth for authentication
- Database access via Drizzle ORM

### Shared Packages

- `@justplay/db`: Drizzle schema, migrations, and database utilities
- `@justplay/gql`: Shared GraphQL types and resolvers
- `@justplay/auth`: Better Auth integration and session management

## Development Workflow

1. **Create a feature branch**: `git checkout -b infra-001/feature-name`
2. **Make changes** with TypeScript strict mode enabled
3. **Run tests**: `pnpm test` in changed packages
4. **Lint and typecheck**: `pnpm lint && pnpm typecheck`
5. **Commit with requirement ID**: `git commit -m "feat(INFRA-001): description"`
6. **Create pull request** referencing requirement ID

See [docs/iterative-design-workflow.md](docs/iterative-design-workflow.md) for details.

## Build Performance

- **Target**: Build under 60 seconds (initial), growth budget to 300 seconds
- **Monitoring**: Check build duration in CI logs
- **Optimization**: Turborepo caches depend on `tsconfig.json` and package inputs

## Code Quality Standards

- TypeScript strict mode enabled globally
- All code must pass: lint, typecheck, tests
- New behavior requires unit tests
- Frontend: responsive CSS, light/dark themes, WCAG 2.1 AA accessibility
- Backend: thin endpoints, transactional logic, domain error types

See [docs/engineering-standards.md](docs/engineering-standards.md) and [docs/testing-strategy.md](docs/testing-strategy.md).

## Troubleshooting

### Build fails with module not found

Ensure all TypeScript paths in `tsconfig.json` match your import statements. Rebuild with:

```bash
pnpm clean && pnpm install && pnpm build
```

### Theme not persisting

Check browser localStorage. Theme preference is stored as `theme` key. Clear and reload:

```javascript
localStorage.clear()
location.reload()
```

### Vite HMR not working

Ensure `localhost` resolves to 127.0.0.1:

```bash
ping localhost
```

If issues persist, modify `vite.config.ts` HMR config for your network.

## Resources

- [Mission & Vision](docs/vision.md)
- [Engineering Standards](docs/engineering-standards.md)
- [Requirements & Use Cases](docs/requirements-and-use-cases.md)
- [Testing Strategy](docs/testing-strategy.md)
- [Iterative Design Workflow](docs/iterative-design-workflow.md)

## Contributing

Read `.github/copilot-instructions.md` for non-negotiable development rules and canonical references.

See `.github/pull_request_template.md` for PR requirements.
