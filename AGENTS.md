# AGENTS.md — expenses-tracking-backend

NestJS 11 API for **ExpenseAI**: automated, personalized monthly expense summaries from Nextcloud files. The backend verifies Supabase JWTs, will persist data via Prisma against Supabase PostgreSQL, and will eventually integrate DeepSeek AI, Brevo SMTP, Nextcloud WebDAV, and a cron webhook.

**Status:** Early foundation — auth wiring and Prisma schema exist; feature modules and `PrismaService` are not implemented yet. See [PLAN.md](./PLAN.md) for the full product roadmap.

## Prerequisites

- **Node.js** `24.16.0` (see `.nvmrc`)
- **pnpm** (only package manager — do not use npm or yarn)
- Supabase project with PostgreSQL and Auth enabled
- Copy `.env.example` to `.env` and fill in values

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm run start:dev` | Dev server with watch (default port `3000`) |
| `pnpm run build` | Compile to `dist/` |
| `pnpm run start:prod` | Run compiled app |
| `pnpm run lint` | ESLint (with auto-fix) |
| `pnpm run format` | Prettier on `src/` and `test/` |
| `pnpm run test` | Unit tests (`*.spec.ts` in `src/`) |
| `pnpm run test:e2e` | E2E tests in `test/` |
| `pnpm prisma migrate dev` | Create/apply migrations (uses `prisma.config.ts`) |
| `pnpm prisma generate` | Regenerate Prisma Client after schema changes |

## Directory structure

```
src/
├── auth/              # JWT strategy, guard, @CurrentUser() decorator
├── app.module.ts      # Root module (ConfigModule, AuthModule)
├── app.controller.ts  # Root HTTP controller
├── app.service.ts
└── main.ts            # Bootstrap (default PORT 3000)

prisma/
├── schema.prisma      # User, Template models
└── migrations/        # Applied SQL migrations

docs/                  # Architecture, conventions, database, tech-stack
test/                  # E2E tests (*.e2e-spec.ts)
```

Planned feature folders under `src/`: `prisma/`, `users/`, `templates/`, `email/`, `webdav/`, `cron/`, `ai/`.

## Key architectural decisions

- **Modular monolith** — one NestJS module per domain (controller + service + DTOs).
- **Supabase Auth** — frontend obtains JWT; backend validates with `SUPABASE_JWT_SECRET` via Passport JWT (`JwtAuthGuard`, `@CurrentUser()`).
- **Prisma 7** — schema and migrations live in `prisma/`; datasource URL from `DATABASE_URL` / `DIRECT_URL` via `prisma.config.ts`. All DB access must go through an injectable `PrismaService` (to be added).
- **REST today** — `GET /`, `GET /profile` (protected). GraphQL is described in [PLAN.md](./PLAN.md) but not implemented.
- **Config** — `ConfigModule` is global; use `ConfigService` in services/strategies, not raw `process.env` in business logic.

## Related documentation

| File | Contents |
|------|----------|
| [PLAN.md](./PLAN.md) | Product requirements, features, todos (Polish) |
| [docs/tech-stack.md](./docs/tech-stack.md) | Libraries and versions |
| [docs/architecture.md](./docs/architecture.md) | System design, auth flow, module graph |
| [docs/conventions.md](./docs/conventions.md) | Coding patterns and how to add features |
| [docs/database.md](./docs/database.md) | Schema, relationships, migrations |
| [.env.example](./.env.example) | Required environment variables |

## Pairing with the frontend

Repo: `expenses-tracking-frontend` (sibling project). The React app uses Supabase Auth; authenticated requests to this API must send:

```
Authorization: Bearer <supabase_access_token>
```

## Common pitfalls

- Do **not** instantiate `PrismaClient` directly in controllers or services — use `PrismaService` once it exists.
- Do **not** use npm/yarn — only `pnpm`.
- `User.id` in Prisma must match Supabase Auth `sub` (UUID) when creating profiles.
- `class-validator` / `class-transformer` are planned for DTOs but not yet in `package.json` — add them when introducing validated DTOs.
- The default [README.md](./README.md) is still the NestJS starter; prefer this file and `docs/` for project context.
