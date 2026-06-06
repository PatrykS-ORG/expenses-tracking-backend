# Backend coding conventions

## File and folder layout

### GraphQL feature module

```
src/
└── <feature>/
    ├── <feature>.module.ts
    ├── <feature>.resolver.ts
    ├── <feature>.service.ts
    ├── dto/
    │   └── *.input.ts
    ├── models/
    │   └── *.model.ts
    └── <feature>.service.spec.ts
```

### REST feature module

```
src/
└── <feature>/
    ├── <feature>.module.ts
    ├── <feature>.controller.ts
    ├── <feature>.service.ts
    ├── dto/
    └── <feature>.service.spec.ts
```

### Provider pattern (for pluggable integrations)

`src/data-sources/` introduces provider-style structure:

```
src/data-sources/
├── data-source.provider.ts
├── data-source-resolver.service.ts
├── data-source.types.ts
├── data-sources.controller.ts
├── data-sources.module.ts
└── providers/
    ├── file-upload.provider.ts
    └── nextcloud.provider.ts
```

Use this pattern for future source adapters (e.g. Google Drive).

## Naming

- File names: kebab-case (`update-data-source.input.ts`)
- Class names: PascalCase (`UpdateDataSourceInput`, `DataSourceResolverService`)
- One primary class per file

## Imports

Order:

1. Nest imports (`@nestjs/*`)
2. Third-party packages
3. Local imports (`./`, `../`)

Use explicit relative imports (no path aliases configured).

## API conventions

- GraphQL is primary for template/settings operations.
- REST is used for:
  - smoke/auth endpoint (`GET /profile`)
  - expense file upload/preview/save endpoints (`/api/data-sources/upload*`)
  - receipt image scan (`POST /api/receipts/scan`)

`ReceiptsModule` is a hybrid module with both a REST controller (scan) and a GraphQL resolver (approve).

For file uploads:

- Guard with `JwtAuthGuard`
- Use `FileInterceptor('file')`
- Validate file type and size in service/controller

## Auth conventions

- REST handlers: `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`
- GraphQL handlers: `@UseGuards(GqlAuthGuard)` + `@CurrentUserGql()`
- Resolve user id via `sub ?? id` in GraphQL payload.

## Service layer rules

- Keep resolvers/controllers thin.
- Put business logic in services.
- Throw Nest exceptions from services (`BadRequestException`, `NotFoundException`, `ServiceUnavailableException`).

## Prisma usage

- Never instantiate `PrismaClient` directly in feature code.
- Inject `PrismaService` in services only.
- Use transactions for multi-step writes.
- Commit migration SQL for every schema change.

## Config and environment variables

- Use `ConfigService` in services.
- Avoid `process.env` in business logic.
- Every new config key must be documented in `.env.example`.

Current critical env groups:

- DB/Auth: `DATABASE_URL`, `DIRECT_URL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`
- Storage: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
- Email: `BREVO_API_KEY`, `MAIL_SENDER`, `MAIL_SENDER_NAME`, `BREVO_BASE_URL`
- AI: `DEEPSEEK_API_KEY`, `DEEPSEEK_VISION_MODEL`, `RECEIPT_OCR_LANG`
- Nextcloud: `NEXTCLOUD_WEBDAV_URL`, `NEXTCLOUD_USERNAME`, `NEXTCLOUD_PASSWORD`

## Testing

- Unit tests colocated as `*.spec.ts`
- E2E tests under `test/`
- Mock `PrismaService` and integration clients where possible

## How to add a feature module

1. Create `src/<feature>/`.
2. Add module + service + resolver/controller.
3. Add DTOs/inputs and model classes.
4. Register module in `AppModule`.
5. Add/update tests.
6. Update docs:
   - `docs/architecture.md` when module/API flows change
   - `docs/database.md` when schema/migrations change
   - `docs/tech-stack.md` when dependencies/integrations change
