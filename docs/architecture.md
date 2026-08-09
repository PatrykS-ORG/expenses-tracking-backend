# Backend architecture

## System context

ExpenseAI backend is a NestJS modular monolith between the React frontend and Supabase (Auth + Postgres + Storage).

Implemented integrations:

- DeepSeek (`AiService`) for template generation, expense analysis, and receipt text extraction.
- Tesseract.js + Sharp (`ReceiptOcrService`) for receipt image preprocessing and OCR (`eng.traineddata` / `pol.traineddata` at repo root).
- Brevo HTTP API (`EmailService`) for sending rendered test emails.
- Supabase Storage + Nextcloud WebDAV as pluggable expense data sources.

Planned (not wired yet):

- ~~Monthly cron webhook pipeline (`/api/cron/process-summaries`).~~ Implemented — see [cron-summaries.md](./cron-summaries.md).

```mermaid
flowchart LR
  subgraph frontend [Frontend]
    React[React_Vite]
    SupaClient[Supabase_JS_Client]
  end
  subgraph backend [NestJS]
    GQL[GraphQL_Apollo]
    REST[REST_endpoints]
    AuthMod[AuthModule]
    TemplatesMod[TemplatesModule]
    DataSourcesMod[DataSourcesModule]
    EmailMod[EmailModule]
    AiMod[AiModule]
    AiUsageMod[AiUsageModule]
    ReceiptsMod[ReceiptsModule]
    SummaryMod[SummaryModule]
    CronMod[CronModule]
    PrismaSvc[PrismaService]
  end
  subgraph supabase [Supabase]
    SupaAuth[Supabase_Auth]
    Postgres[(PostgreSQL)]
    Storage[(Storage)]
  end
  subgraph external [External]
    DeepSeek[DeepSeek_API]
    Tesseract[Tesseract_OCR]
    Brevo[Brevo_API]
    Nextcloud[Nextcloud_WebDAV]
  end

  React --> SupaClient
  SupaClient --> SupaAuth
  React -->|"Bearer JWT"| GQL
  React -->|"Bearer JWT"| REST
  GQL --> AuthMod
  REST --> AuthMod
  AuthMod --> SupaAuth
  TemplatesMod --> PrismaSvc
  TemplatesMod --> AiMod
  TemplatesMod --> EmailMod
  DataSourcesMod --> PrismaSvc
  DataSourcesMod --> Storage
  DataSourcesMod --> Nextcloud
  ReceiptsMod --> AiMod
  ReceiptsMod --> DataSourcesMod
  ReceiptsMod --> TemplatesMod
  AiMod --> AiUsageMod
  AiMod --> OcrMod
  AiMod --> DeepSeek
  AiUsageMod --> PrismaSvc
  OcrMod --> Tesseract
  EmailMod --> Brevo
  SummaryMod --> AiMod
  SummaryMod --> AiUsageMod
  SummaryMod --> EmailMod
  SummaryMod --> DataSourcesMod
  CronMod --> SummaryMod
  PrismaSvc --> Postgres
```

## Module graph

`AppModule` imports:

- `ConfigModule` (global)
- `GraphQLModule` (Code First, `src/schema.gql`)
- `PrismaModule`
- `AuthModule`
- `AiUsageModule`
- `AiModule`
- `TemplatesModule`
- `DataSourcesModule`
- `EmailModule`
- `ReceiptsModule`
- `SummaryModule`
- `CronModule`

### Implemented modules

| Module              | Responsibility                                                               |
| ------------------- | ---------------------------------------------------------------------------- |
| `AuthModule`        | JWT strategy + guards for REST/GraphQL                                       |
| `UsersModule`       | User-profile provisioning and authenticated account deletion                 |
| `PrismaModule`      | Shared Prisma adapter client                                                 |
| `AiUsageModule`     | Monthly AI credit limits, usage audit log, GraphQL usage queries             |
| `AiModule`          | DeepSeek template generation, expense analysis, and receipt extraction       |
| `ReceiptOcrModule`  | Tesseract worker lifecycle, image preprocessing (Sharp), OCR text extraction |
| `TemplatesModule`   | Template CRUD + active template + source settings + test-email mutation      |
| `DataSourcesModule` | Source providers, upload endpoint, source resolution                         |
| `EmailModule`       | Brevo email sending                                                          |
| `ReceiptsModule`    | Receipt scan + `approveReceiptExpenses` GraphQL mutations + OCR              |
| `SummaryModule`     | Summary schedule + monthly analytics GraphQL + batch summary pipeline        |
| `CronModule`        | Secured REST webhook for hourly batch processing                             |

### REST endpoints

| Method | Path                          | Auth                 | Notes                                           |
| ------ | ----------------------------- | -------------------- | ----------------------------------------------- |
| `POST` | `/api/cron/process-summaries` | `Bearer CRON_SECRET` | Hourly batch trigger for monthly summary emails |

## Authentication flow

1. Frontend authenticates with Supabase (email/password or Google OAuth 2.0) and gets `access_token`.
2. Frontend calls NestJS with `Authorization: Bearer <token>`.
3. REST uses `JwtAuthGuard`; GraphQL uses `GqlAuthGuard`. (REST controllers were removed; guards remain available if REST is reintroduced.)
4. `JwtStrategy` validates token via:
   - Supabase JWKS (`SUPABASE_URL`) for ES256 projects
   - or legacy `SUPABASE_JWT_SECRET` for HS256
5. Handlers get user via `@CurrentUser()` / `@CurrentUserGql()`.
6. `UserProfileService.ensureUserProfile` upserts local `User` profile on first authenticated access.

## Data-source architecture

Expense data source is resolved per user from:

- `data_source_type` (`FILE_UPLOAD` / `NEXTCLOUD`)
- `data_source_config` (provider-specific JSON)

`DataSourceResolverService` dispatches to:

- `FileUploadProvider` (read file from Supabase Storage)
- `NextcloudProvider` (read file from Nextcloud WebDAV path)

`SupabaseStorageService` talks to Supabase Storage via direct REST (`axios` + service role key), not the Supabase JS client. It supports `readTextFileOrEmpty` for optional file reads used by receipt approval.

## API surface

All client-facing operations are exposed through GraphQL at `/graphql`.

| Kind     | Name                          | Auth   | Notes                                                                                            |
| -------- | ----------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| Query    | `health`                      | Public | Health/hello smoke check                                                                         |
| Query    | `myProfile`                   | JWT    | Auth smoke test                                                                                  |
| Query    | `myTemplates`                 | JWT    | List current user templates                                                                      |
| Query    | `myTemplateSettings`          | JWT    | Active template + source settings                                                                |
| Query    | `currentExpenseFile`          | JWT    | Current uploaded file metadata + content                                                         |
| Mutation | `generateTemplate`            | JWT    | Generate template via DeepSeek                                                                   |
| Mutation | `createTemplate`              | JWT    | Create template                                                                                  |
| Mutation | `updateTemplate`              | JWT    | Update template                                                                                  |
| Mutation | `deleteTemplate`              | JWT    | Delete template                                                                                  |
| Mutation | `setActiveTemplate`           | JWT    | Set active template                                                                              |
| Mutation | `updateDataSource`            | JWT    | Switch/update source config                                                                      |
| Mutation | `uploadExpenseFile`           | JWT    | Upload `.txt/.csv` (max 5MB, base64), set source to `FILE_UPLOAD`                                |
| Mutation | `overwriteCurrentExpenseFile` | JWT    | Overwrite currently configured uploaded file (base64)                                            |
| Mutation | `sendTestEmail`               | JWT    | Render active template with sample values and send via Brevo                                     |
| Query    | `mySummarySchedule`           | JWT    | Read automatic summary schedule settings                                                         |
| Mutation | `updateSummarySchedule`       | JWT    | Update schedule and recalculate `next_summary_at`                                                |
| Mutation | `updateSalary`                | JWT    | Persist current profile salary (`User.salary_cents`) from a money string                         |
| Mutation | `sendSummaryNow`              | JWT    | Analyze the current expense file and email a real summary without changing schedule              |
| Query    | `mySummaries`                 | JWT    | List persisted monthly analytics for ended months (`period < current YYYY-MM`)                   |
| Query    | `mySummary(month)`            | JWT    | Single-month analytics (`null` if current/future or missing); months before `2026-01` rejected   |
| Query    | `summaryCategoryKeys`         | JWT    | Closed English category vocabulary for manual backfill UI                                        |
| Mutation | `createManualSummary`         | JWT    | Create historical analytics (`source = MANUAL`) for any ended month (`period < current YYYY-MM`) |
| Mutation | `updateManualSummary`         | JWT    | Update an existing analytics row for an ended month (scheduled or manual)                        |
| Mutation | `deleteMyAccount`             | JWT    | Delete Supabase Auth identity, profile data, and uploaded expense file                           |
| Mutation | `scanReceipt`                 | JWT    | Upload receipt image (JPEG/PNG/WEBP, max 5MB, base64); returns `{ extractedText }`               |
| Mutation | `approveReceiptExpenses`      | JWT    | Append edited receipt expense text to the user's uploaded expense file                           |
| Query    | `myAiUsageSummary`            | JWT    | Current-month AI credit limit / used / remaining                                                 |
| Query    | `myAiUsageLog`                | JWT    | Paginated AI spend audit (`limit`, `offset`)                                                     |

File upload mutations accept `ExpenseFileUploadInput` / `ScanReceiptInput` with `fileName`, `mimeType`, and `contentBase64` fields.

## Receipt scan + approval flow

`scanReceipt` (`ReceiptsResolver` → `ReceiptsService`):

1. Ensures the authenticated user profile exists.
2. Validates image type and size.
3. `AiService.extractExpensesFromImage` checks the AI credit limit, preprocesses the image (Sharp), runs OCR (`ReceiptOcrService` / Tesseract), then sends OCR text to DeepSeek and records token usage.
4. Returns plain-text expense lines (or `NO_EXPENSES_FOUND`).

DeepSeek's hosted API is text-only (no image input support), so extraction accuracy depends entirely on OCR text quality:

- `ReceiptOcrService` runs Tesseract with `PSM.SINGLE_COLUMN` (configurable via `RECEIPT_OCR_PSM`), not `PSM.AUTO`. Receipts are narrow single-column strips of text; `PSM.AUTO`'s full page-layout analysis reliably misdetects the item-name column and the "qty × unit price / total" column as two separate blocks and emits all names first, then all prices — silently decoupling every item from its price. `SINGLE_COLUMN` keeps each physical receipt line intact.
- `receipt-image-preprocessor.ts` builds 3 OCR-ready variants (contrast-enhanced, adaptive-threshold, fixed-threshold) in parallel; `pickBestCandidate` scores them by `confidence × wordCount` rather than raw word count (which rewards noisy binarization that "recognizes" garbage tokens).
- `RECEIPT_SCAN_PROMPT` encodes the structural conventions of Polish receipts (name + trailing VAT-letter line, `qty x unit_price total` line below it, `OPUST` discount lines tied to the preceding item) and explicitly forbids borrowing a price from an unrelated section (e.g. VAT/totals block) when an item's own price is unclear — the model must skip that item instead.

`approveReceiptExpenses` (`ReceiptsResolver` → `ReceiptsService`):

1. Resolves the user's `FILE_UPLOAD` source config via `TemplatesService`.
2. Reads current file content (empty string if missing).
3. Appends approved receipt text and overwrites the Storage object.
4. Updates `uploadedAt` in `data_source_config`.

## Expense analysis flow

`AiService.analyzeExpenses(userId, rawExpenseContent, salaryCents, language, currency, period, trigger)` returns `{ summary, snapshot }`:

1. `AiUsageService.ensureWithinLimit(userId)` rejects the call when the monthly credit budget is exhausted.
2. `parseExpenseFile()` (`src/ai/expense-file.parser.ts`) deterministically parses raw expense text into a canonical expense list (duplicate names are merged case/whitespace-insensitively; every amount is stored in cents). Salary is **not** read from the file — callers pass `User.salary_cents`.
3. DeepSeek receives only the canonical expense list (`id`, `name`, `amount`) and a computed totals hint (including the profile salary). Its JSON response is limited to closed English category names + `itemIds` assignments and a `savingsMessage` — it never computes or returns amounts, totals, salary, or the current month. Allowed category keys live in `src/summary/summary-category.constants.ts`.
4. Token usage from `response.usage` is written to `AiUsageLog` (success or failure) with action `EXPENSE_SUMMARY` and the caller-supplied trigger (`MANUAL` / `SCHEDULED`).
5. `reconcileExpenseAnalysis()` (`src/ai/expense-analysis.reconciler.ts`) rebuilds `salaryAmount`, `totalExpenses`, `savingsAmount`, and per-category/item totals purely from the canonical cents plus the provided salary. AI-provided `itemIds` are validated against the canonical list; unknown or duplicate IDs are dropped and any unassigned expenses fall into an "Other expenses" category. This guarantees totals stay internally consistent even if the AI miscategorizes something.
6. `formatMoneyAmount()` (`src/ai/expense-amount.formatter.ts`) formats cents into locale-aware strings (e.g. `1 234,56 zł` for PL, `1,234.56 PLN` for EN) for the email `summary`.
7. `currentMonth` is derived from the caller-supplied `period` (`YYYY-MM`) via `formatSummaryMonth()` instead of "now", so cron-generated summaries always label the month they actually cover.
8. `snapshot` is a cents-based `SummaryAnalyticsSnapshot` with categories remapped to the closed vocabulary via `buildCanonicalCategoriesFromExpenses()` — used to persist dashboard analytics after a successful scheduled send.

All arithmetic stays deterministic in application code; the LLM is only responsible for categorization and the natural-language `savingsMessage`.

## Summary analytics flow

Persisted monthly snapshots live in `SummaryAnalytics` (one row per `(user_id, period)`), separate from email idempotency in `SummaryLog`.

**Scheduled write** (cron only): after a successful summary email, `SummaryService.insertAnalyticsIfMissing` inserts `source = SCHEDULED` when no row exists for that period. Existing analytics are never overwritten by cron. `sendSummaryNow` emails only and does not write analytics.

**Manual backfill** (`createManualSummary` / `updateManualSummary`):

1. Validates `period` as `YYYY-MM`, rejects months before `2026-01`.
2. Create and update/view require an ended month (`period < current YYYY-MM` in the user's timezone). Once the new month has started, the previous month can be created manually. Cron never overwrites an existing analytics row for that period.
3. `parseManualSummaryPayload()` parses salary/category money strings into cents, normalizes category names through the closed vocabulary (+ aliases), and recomputes totals/savings in code.
4. Create sets `source = MANUAL` and snapshots `User.summary_currency`. Update rewrites amounts/categories/message but does not change `source` or currency.

**Reads**: `mySummaries` lists ended months only; `mySummary(month)` returns `null` for the current/future month (or missing rows); `summaryCategoryKeys` exposes the vocabulary for the UI.

## AI credits and usage audit

Monthly AI spend is tracked in `AiUsageModule` / `AiUsageService`.

- **Unit**: `1 credit = AI_TOKENS_PER_CREDIT` tokens (default `1000`), rounded up via `Math.ceil`.
- **Limit**: stored per user on `User.ai_credit_limit` (default from `AI_MONTHLY_CREDIT_LIMIT`, default `50`). Applied when the profile is first created.
- **Period**: UTC calendar month (`periodStart` inclusive → `periodEnd` exclusive).
- **Actions audited**: `TEMPLATE_GENERATION`, `EXPENSE_SUMMARY`, `RECEIPT_SCAN`.
- **Triggers**: `MANUAL` (user-initiated GraphQL) or `SCHEDULED` (cron summary batch).
- **Enforcement**:
  - Manual AI calls (`generateTemplate`, `scanReceipt`, `sendSummaryNow`) throw `BadRequestException` when `used >= limit`.
  - Cron batch pre-checks `hasRemainingCredits`; over-limit users are `skipped` with reason `AI credit limit reached` (no DeepSeek call).
- **Recording**: every DeepSeek completion records `prompt_tokens`, `completion_tokens`, `total_tokens`, computed `credits_used`, success flag, and optional `error_message` — even when downstream content validation fails (tokens were still spent).
- **API**: `myAiUsageSummary`, `myAiUsageLog(limit, offset)`.

## Rendering + email flow

`TemplatesService.sendTestEmail`:

1. Ensures user exists and has active template.
2. Uses `template-renderer.ts` to inject sample values.
3. Calls `EmailService.sendEmail(...)` to Brevo `/smtp/email`.

## Error handling and resiliency

- Service layer throws typed Nest exceptions for domain errors.
- Provider misconfiguration returns `ServiceUnavailableException`.
- Upload/download storage failures bubble with context-rich messages.
- Cron fault-tolerance behavior is implemented in `SummaryService.processDueSummaries()` — per-user try/catch with `SummaryLog` persistence.

See [cron-summaries.md](./cron-summaries.md) for scheduler and webhook details.

## Security notes

- Secrets remain server-side (`DEEPSEEK_API_KEY`, `BREVO_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Nextcloud credentials).
- Non-secret AI quota knobs (`AI_TOKENS_PER_CREDIT`, `AI_MONTHLY_CREDIT_LIMIT`) are env vars / GitHub environment variables.
- Frontend only uses Supabase user access token; service role key is never exposed.
- Prisma adapter strips SSL params from URL and applies explicit TLS option via `DATABASE_SSL_REJECT_UNAUTHORIZED`.

See also [database.md](./database.md), [conventions.md](./conventions.md), and [processes/ai-credit-renewal.md](./processes/ai-credit-renewal.md).
