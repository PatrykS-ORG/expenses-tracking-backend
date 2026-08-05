# AGENTS.md — expenses-tracking-backend

NestJS 11 API for **ExpenseAI**.  
Current scope includes:

- Supabase JWT auth (GraphQL guards)
- Prisma persistence (`User`, `Template`, `SummaryLog`, `SummaryAnalytics`, `AiUsageLog`)
- AI template generation and expense analysis (DeepSeek)
- Monthly AI credit limits + spend audit (`AiUsageModule`)
- Data-source abstraction (`FILE_UPLOAD` via Supabase Storage, `NEXTCLOUD` via WebDAV)
- Receipt OCR scan (Tesseract + Sharp) and AI expense extraction (DeepSeek)
- Receipt expense approval (append to uploaded expense file)
- Test-email sending through Brevo API
- Monthly summary cron webhook (`/api/cron/process-summaries`)
- Monthly expense analytics GraphQL (scheduled snapshots + manual historical backfill)

## Prerequisites

- Node.js `24.16.0`
- pnpm (required package manager)
- Supabase project (Auth + Postgres + Storage)
- Copy `.env.example` to `.env`

## Commands

| Command                      | Purpose                                    |
| ---------------------------- | ------------------------------------------ |
| `pnpm install`               | Install deps and generate Prisma client    |
| `pnpm run start:dev`         | Start backend in watch mode                |
| `pnpm run build`             | Build Nest app                             |
| `pnpm run lint`              | ESLint + Prettier check                    |
| `pnpm run lint:fix`          | Auto-fix ESLint and Prettier issues        |
| `pnpm run format`            | Format all files with Prettier             |
| `pnpm run format:check`      | Verify Prettier formatting without writing |
| `pnpm run test`              | Run unit tests                             |
| `pnpm prisma migrate dev`    | Create/apply migration in dev              |
| `pnpm prisma migrate deploy` | Apply existing migrations                  |
| `pnpm prisma generate`       | Regenerate Prisma client                   |

A Husky pre-commit hook runs `lint-staged` (ESLint + Prettier) on staged files before each commit.

## Directory structure

```
src/
├── auth/                    # JWT strategy, guards, decorators
├── prisma/                  # PrismaService + module
├── ai/                      # DeepSeek integration
├── ai-usage/                # AI credit limits + usage audit GraphQL
├── templates/               # GraphQL templates + settings + test-email mutation
├── data-sources/            # GraphQL upload queries/mutations + source providers
├── receipts/                # Receipt scan + approveReceiptExpenses GraphQL mutations + OCR
├── summary/                 # Summary schedule + analytics GraphQL + batch pipeline
├── cron/                    # Secured REST webhook for hourly summaries
├── email/                   # Brevo client + HTML template rendering helper
├── users/                   # Profile provisioning + account deletion
├── schema.gql               # Auto-generated GraphQL schema
├── app.resolver.ts          # health + myProfile queries
├── app.module.ts
└── main.ts

prisma/
├── schema.prisma
└── migrations/
```

## Key architectural decisions

- GraphQL is the sole client-facing API; file uploads use base64-encoded mutation inputs.
- OCR language data files (`eng.traineddata`, `pol.traineddata`) live at the repo root for Tesseract.
- User data source is normalized as:
  - `data_source_type`
  - `data_source_config` JSON
- Data-source provider pattern in `src/data-sources/providers/` allows new connectors later.
- Email sending uses Brevo HTTP endpoint (`/smtp/email`) through `EmailService`.
- Prisma adapter strips SSL URL params and applies explicit TLS option from env.
- Expense analysis math is deterministic, not AI-generated: `src/ai/expense-file.parser.ts` parses/merges raw expense text into canonical cents, `src/ai/expense-analysis.reconciler.ts` rebuilds totals from that canonical data, and `src/ai/expense-amount.formatter.ts` formats it. DeepSeek only assigns category `itemIds` (closed English keys from `src/summary/summary-category.constants.ts`) and writes `savingsMessage` — it never returns amounts, totals, or the month.
- Monthly dashboard analytics are stored in `SummaryAnalytics` (one row per user/period). Cron inserts `SCHEDULED` snapshots only when missing; `sendSummaryNow` does not write analytics. Manual create/update uses the same closed category vocabulary.
- Every DeepSeek call is credit-gated and audited via `AiUsageService` (`AiUsageLog`). Credits = `ceil(tokens / AI_TOKENS_PER_CREDIT)`. Manual calls error when over limit; cron summaries skip over-limit users.

## Environment variables (high-level)

- DB/Auth: `DATABASE_URL`, `DIRECT_URL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`
- Storage: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
- AI: `DEEPSEEK_API_KEY`, `DEEPSEEK_VISION_MODEL`, `RECEIPT_OCR_LANG`, `AI_TOKENS_PER_CREDIT`, `AI_MONTHLY_CREDIT_LIMIT`
- Email: `BREVO_API_KEY`, `MAIL_SENDER`, `MAIL_SENDER_NAME`, `BREVO_BASE_URL`
- Nextcloud: `NEXTCLOUD_WEBDAV_URL`, `NEXTCLOUD_USERNAME`, `NEXTCLOUD_PASSWORD`

## Common pitfalls

- Do not instantiate `PrismaClient` directly in feature code.
- Do not hand-edit `src/schema.gql`.
- Use `Authorization: Bearer <supabase_access_token>` for protected endpoints.
- Keep secrets server-side only (never expose service role key to frontend).

See `docs/architecture.md`, `docs/database.md`, `docs/conventions.md`, and `docs/processes/ai-credit-renewal.md` for full details.
