# Backend coding conventions

## File and folder layout

```
src/
└── <feature>/
    ├── <feature>.module.ts
    ├── <feature>.controller.ts
    ├── <feature>.service.ts
    ├── dto/
    │   ├── create-<feature>.dto.ts
    │   └── update-<feature>.dto.ts
    ├── <feature>.service.spec.ts
    └── guards/ or decorators/   # only when feature-specific
```

- **kebab-case** file names: `jwt-auth.guard.ts`, `current-user.decorator.ts`
- **PascalCase** classes: `TemplatesService`, `JwtAuthGuard`
- One primary class per file
- Shared auth pieces live in `src/auth/`; shared Prisma wiring in `src/prisma/` (when added)

## Import order

1. NestJS decorators and framework imports (`@nestjs/*`)
2. Third-party packages
3. Local relative imports (`./`, `../`)

Use explicit imports; no path aliases are configured in `tsconfig.json`.

## Naming

| Artifact | Convention | Example |
|----------|------------|---------|
| Module | `<Feature>Module` | `TemplatesModule` |
| Controller | `<Feature>Controller` | `TemplatesController` |
| Service | `<Feature>Service` | `TemplatesService` |
| DTO | `<Action><Feature>Dto` | `CreateTemplateDto` |
| Guard | `<Name>Guard` | `JwtAuthGuard` |
| Spec file | same base + `.spec.ts` | `templates.service.spec.ts` |

## DTOs and validation

When adding validated endpoints:

1. Install/use `class-validator` and `class-transformer`.
2. Define request DTOs in `dto/` with validation decorators.
3. Enable `ValidationPipe` globally or on the controller (to be added with first DTO endpoints).
4. Prefer explicit response types or DTOs instead of returning full Prisma models.

Example shape (illustrative):

```typescript
// dto/create-template.dto.ts
export class CreateTemplateDto {
  name: string;
  content: string; // HTML with placeholder variables
}
```

## Environment variables

- Access via **`ConfigService`** in constructors: `constructor(private config: ConfigService) {}`
- Register new keys in `.env.example` with a short comment
- `JwtStrategy` already uses `ConfigService` for `SUPABASE_JWT_SECRET`

Avoid `process.env` in services except in bootstrap edge cases.

## Error handling

- **Services** throw domain-appropriate `HttpException` subclasses.
- **Controllers** stay thin — delegate to services.
- For batch/cron work: catch per-user errors, log, continue ([PLAN.md](../PLAN.md)).

## Authentication in handlers

```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@CurrentUser() user: { id: string; email: string; roles: string }) {
  return this.usersService.findById(user.id);
}
```

Type `@CurrentUser()` properly when introducing shared interfaces (e.g. `AuthUser`).

## Prisma usage (when `PrismaService` exists)

- Inject `PrismaService` into services only — not controllers.
- Use transactions for multi-step writes (e.g. set active template + validate ownership).
- Run migrations after every schema change; commit migration SQL under `prisma/migrations/`.

## Testing

| Type | Location | Naming |
|------|----------|--------|
| Unit | Next to source | `*.spec.ts` |
| E2E | `test/` | `*.e2e-spec.ts` |

- Mock `PrismaService` in unit tests.
- E2E: use `Test.createTestingModule({ imports: [AppModule] })` + Supertest.
- Add auth tests with a valid test JWT or mocked guard when expanding coverage.

## How to add a new feature module

1. Create folder `src/<feature>/` with module, controller, service.
2. Add DTOs under `dto/` if the feature exposes HTTP input.
3. Import `<Feature>Module` in `AppModule`.
4. Inject `PrismaService` in the service if persistence is needed.
5. Protect routes with `JwtAuthGuard` unless explicitly public (e.g. cron with `CRON_SECRET`).
6. Add unit tests for service logic; E2E for critical HTTP paths.
7. Update [architecture.md](./architecture.md) and [database.md](./database.md) if schema or system boundaries change.
8. Document new env vars in `.env.example`.

## Code style

- **Prettier**: `singleQuote: true`, `trailingComma: 'all'`
- **ESLint**: flat config in `eslint.config.mjs`; `no-explicit-any` is off — prefer typing new code
- **Language**: English for code comments; Polish allowed for user-visible API strings consistent with the app

## Package manager

Always **`pnpm`**. Scripts are defined in [package.json](../package.json).
