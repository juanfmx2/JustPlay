# JustPlay

Web tool to organize and manage competitive volleyball games.

## Local PostgreSQL + Drizzle setup

This project is configured with:

- PostgreSQL in Docker (`docker-compose.yml`)
- Drizzle ORM (`drizzle-orm`)
- Drizzle migrations + studio (`drizzle-kit`)

### 1. Configure environment

Create your local `.env` from the template:

```bash
cp .env.example .env
```

### 2. Start PostgreSQL locally

```bash
pnpm db:up
```

Optional logs:

```bash
pnpm db:logs
```

### 3. Create and run migrations

Generate SQL migration files from `src/schema`:

```bash
pnpm db:generate
```

Apply migrations to the database:

```bash
pnpm db:migrate
```

### 4. Open Drizzle Studio

```bash
pnpm db:studio
```

### 5. Stop PostgreSQL

```bash
pnpm db:down
```

## Notes

- Drizzle config is in `drizzle.config.ts`.
- Database client is in `src/db/client.ts`.
- Schema definitions are in `src/schema`.
