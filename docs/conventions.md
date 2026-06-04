# Backend coding conventions

## File and folder layout

### REST feature module

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

### GraphQL feature module (Code First)

Example: `src/templates/`

```
src/
└── <feature>/
    ├── <feature>.module.ts
    ├── <feature>.resolver.ts
    ├── <feature>.service.ts
    ├── dto/
    │   ├── create-<feature>.input.ts
    │   └── update-<feature>.input.ts
    ├── models/
    │   └── <entity>.model.ts
    └── <feature>.service.spec.ts
```

- **kebab-case** file names: `gql-auth.guard.ts`, `create-template.input.ts`
- **PascalCase** classes: `TemplatesService`, `TemplatesResolver`, `GqlAuthGuard`
- One primary class per file
- Shared auth in `src/auth/`; shared Prisma in `src/prisma/`
- Generated schema: `src/schema.gql` (do not edit by hand)

## Import order

1. NestJS decorators and framework imports (`@nestjs/*`)
2. Third-party packages
3. Local relative imports (`./`, `../`)

Use explicit imports; no path aliases are configured in `tsconfig.json`.

## Naming

| Artifact | Convention | Example |
|----------|------------|---------|
| Module | `<Feature>Module` | `TemplatesModule` |
| Controller | `<Feature>Controller` | `AppController` |
| Resolver | `<Feature>Resolver` | `TemplatesResolver` |
| Service | `<Feature>Service` | `TemplatesService` |
| REST DTO | `<Action><Feature>Dto` | `CreateTemplateDto` |
| GraphQL input | `<Action><Feature>Input` | `CreateTemplateInput` |
| GraphQL object | `<Entity>` (model class) | `Template` |
| Guard | `<Name>Guard` | `JwtAuthGuard`, `GqlAuthGuard` |
| Spec file | same base + `.spec.ts` | `templates.service.spec.ts` |

## DTOs and validation

When adding validated endpoints:

1. Install/use `class-validator` and `class-transformer`.
2. Define request types in `dto/` with validation decorators (REST DTOs or GraphQL `@InputType()` classes).
3. Enable `ValidationPipe` globally or on the controller when REST validation is introduced.
4. Prefer explicit GraphQL object types (`@ObjectType()`) instead of returning raw Prisma entities with sensitive fields.

Example (GraphQL input — current pattern):

```typescript
// dto/create-template.input.ts
@InputType()
export class CreateTemplateInput {
  @Field()
  name: string;

  @Field()
  content: string;
}
```

## Environment variables

- Access via **`ConfigService`** in constructors: `constructor(private config: ConfigService) {}`
- Register new keys in `.env.example` with a short comment
- `JwtStrategy` uses `ConfigService` for `SUPABASE_URL` (JWKS / ES256) or `SUPABASE_JWT_SECRET` (legacy HS256)

Avoid `process.env` in services except in bootstrap edge cases (`main.ts` may use `PORT`).

## Error handling

- **Services** throw domain-appropriate `HttpException` subclasses.
- **Controllers / resolvers** stay thin — delegate to services.
- For batch/cron work: catch per-user errors, log, continue processing remaining users.

## Authentication in handlers

### REST

```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(@CurrentUser() user: { id: string; email?: string; roles?: string }) {
  return { user };
}
```

### GraphQL

```typescript
@UseGuards(GqlAuthGuard)
@Query(() => [Template])
async myTemplates(@CurrentUserGql() user: AuthenticatedUser) {
  const userId = user.sub ?? user.id;
  return this.templatesService.findAllByUser(userId);
}
```

Type shared user payloads when introducing an `AuthUser` interface.

## Prisma usage

- Inject `PrismaService` into services only — not controllers or resolvers.
- Use transactions for multi-step writes (e.g. set active template + validate ownership).
- Run migrations after every schema change; commit migration SQL under `prisma/migrations/`.

## Testing

| Type | Location | Naming |
|------|----------|--------|
| Unit | Next to source | `*.spec.ts` |
| E2E | `test/` | `*.e2e-spec.ts` |

- Mock `PrismaService` and JWT guards in unit tests.
- E2E: use `Test.createTestingModule({ imports: [AppModule] })` + Supertest.
- Add auth tests with a valid test JWT or mocked guard when expanding coverage.

## How to add a new feature module

1. Create folder `src/<feature>/` with module and service.
2. Expose API via **GraphQL resolver** (preferred for product features) and/or **REST controller**.
3. Add `dto/` inputs (GraphQL) or DTOs (REST) as needed; add `models/` for GraphQL object types.
4. Import `<Feature>Module` in `AppModule`.
5. Inject `PrismaService` in the service if persistence is needed.
6. Protect endpoints: `GqlAuthGuard` + `@CurrentUserGql()` for GraphQL; `JwtAuthGuard` + `@CurrentUser()` for REST; cron uses `CRON_SECRET` (planned).
7. Add unit tests for service logic; E2E for critical paths.
8. Update [architecture.md](./architecture.md) and [database.md](./database.md) if schema or system boundaries change.
9. Document new env vars in `.env.example`.

## Code style

- **Prettier**: `singleQuote: true`, `trailingComma: 'all'`
- **ESLint**: flat config in `eslint.config.mjs`; `no-explicit-any` is off — prefer typing new code
- **Language**: English for code comments; Polish allowed for user-visible API strings consistent with the app

## Package manager

Always **`pnpm`**. Scripts are defined in [package.json](../package.json).
