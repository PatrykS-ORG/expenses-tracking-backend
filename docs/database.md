# Database documentation

PostgreSQL is hosted on Supabase and accessed through Prisma 7 (`@prisma/client` + `@prisma/adapter-pg`).

- Schema: [prisma/schema.prisma](../prisma/schema.prisma)
- Migrations: `prisma/migrations/`
- Prisma config: [prisma.config.ts](../prisma.config.ts)

## Models (current)

### `User`

Application profile linked to Supabase Auth (`User.id` should match JWT `sub`).

| Field                    | Type                   | Description                                              |
| ------------------------ | ---------------------- | -------------------------------------------------------- |
| `id`                     | `String` PK            | Supabase Auth UID                                        |
| `email`                  | `String` unique        | User email                                               |
| `data_source_type`       | `DataSourceType`       | Selected source (`FILE_UPLOAD` / `NEXTCLOUD`)            |
| `data_source_config`     | `Json?`                | Provider-specific configuration payload                  |
| `active_template_id`     | `String?` FK           | Currently active template                                |
| `summary_schedule_day`   | `Int`                  | Day of month for automatic summary (`1-28`, default `1`) |
| `summary_schedule_hour`  | `Int`                  | Hour of day for automatic summary (`0-23`, default `8`)  |
| `summary_timezone`       | `String`               | IANA timezone (default `Europe/Warsaw`)                  |
| `summary_email_language` | `SummaryEmailLanguage` | Email output language (`PL` / `EN`, default `PL`)        |
| `summary_enabled`        | `Boolean`              | Whether user receives automatic summaries                |
| `next_summary_at`        | `DateTime?`            | Next planned send timestamp (UTC)                        |
| `created_at`             | `DateTime`             | Profile creation timestamp                               |

Relations:

- `templates` — owned templates
- `activeTemplate` — selected template (`ActiveTemplate` relation)
- `summaryLogs` — history of processed summary periods

### `SummaryLog`

Batch processing history and idempotency guard.

| Field           | Type               | Description                        |
| --------------- | ------------------ | ---------------------------------- |
| `id`            | `String` PK        | Log id                             |
| `user_id`       | `String` FK        | Owner id                           |
| `period`        | `String`           | Summary period key, e.g. `2026-05` |
| `status`        | `SummaryLogStatus` | `SUCCESS` or `FAILURE`             |
| `error_message` | `String?`          | Failure reason when applicable     |
| `sent_at`       | `DateTime`         | Processing timestamp               |

Unique constraint: `(user_id, period)`.

### `Template`

HTML email template with dynamic placeholders.

| Field        | Type        | Description        |
| ------------ | ----------- | ------------------ |
| `id`         | `String` PK | Template id        |
| `user_id`    | `String` FK | Owner id           |
| `name`       | `String`    | Display name       |
| `content`    | `String`    | Raw HTML           |
| `created_at` | `DateTime`  | Creation timestamp |

Relations:

- `user` — owner (`onDelete: Cascade`)
- `activeForUsers` — users who selected this template as active

### `DataSourceType` enum

| Value         | Meaning                                          |
| ------------- | ------------------------------------------------ |
| `FILE_UPLOAD` | Expense text/csv file stored in Supabase Storage |
| `NEXTCLOUD`   | Expense file fetched from Nextcloud WebDAV       |

### `SummaryLogStatus` enum

| Value     | Meaning            |
| --------- | ------------------ |
| `SUCCESS` | Summary email sent |
| `FAILURE` | Processing failed  |

### `SummaryEmailLanguage` enum

| Value | Meaning               |
| ----- | --------------------- |
| `PL`  | Polish summary email  |
| `EN`  | English summary email |

## `data_source_config` shapes

### `FILE_UPLOAD`

```json
{
  "bucket": "expenses",
  "filePath": "user-uuid/2026-06.txt",
  "uploadedAt": "2026-06-05T12:00:00.000Z",
  "originalFileName": "wydatki-czerwiec.txt"
}
```

### `NEXTCLOUD`

```json
{
  "filePath": "/shared/wydatki/2026-06.txt"
}
```

## Relationship diagram

```mermaid
erDiagram
  User ||--o{ Template : owns
  User }o--o| Template : activeTemplate
  User ||--o{ SummaryLog : logs
  User {
    string id PK
    string email UK
    string data_source_type
    json data_source_config
    string active_template_id FK
    int summary_schedule_day
    int summary_schedule_hour
    string summary_timezone
    boolean summary_enabled
    datetime next_summary_at
    datetime created_at
  }
  Template {
    string id PK
    string user_id FK
    string name
    string content
    datetime created_at
  }
  SummaryLog {
    string id PK
    string user_id FK
    string period
    string status
    string error_message
    datetime sent_at
  }
```

## Migrations

| Migration                                   | Description                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `20260603205715_init`                       | Initial `User` + `Template` schema                                                                        |
| `20260604120000_drop_active_template_fk`    | Placeholder migration to keep history consistent                                                          |
| `20260605133200_add_data_sources`           | Adds `DataSourceType`, `data_source_type`, `data_source_config`; migrates and drops `nextcloud_file_path` |
| `20260614120000_add_summary_schedule`       | Adds summary schedule fields on `User`, `SummaryLog`, and `SummaryLogStatus` enum                         |
| `20260614200000_add_summary_email_language` | Adds `summary_email_language` (`PL` / `EN`) on `User`                                                     |

## Business rules

- Every authenticated user is upserted on-demand in `UserProfileService.ensureUserProfile`.
- At most one active template per user (`active_template_id`).
- `updateDataSource` enforces:
  - Nextcloud path required for `NEXTCLOUD`
  - existing upload config preserved when switching to `FILE_UPLOAD`
- Upload endpoint stores file in Storage and persists source config in `User.data_source_config`.
- `approveReceiptExpenses` appends approved receipt text to the user's existing `FILE_UPLOAD` expense file (creates content if the file is missing) and updates `uploadedAt` in `data_source_config`. Requires `FILE_UPLOAD` as the active data source.
- Automatic summaries require `summary_enabled = true`, active template, valid data source config, and a computed `next_summary_at`.

See [cron-summaries.md](./cron-summaries.md) for batch processing details.

## Commands

```bash
# apply local schema changes and create a migration
pnpm prisma migrate dev --name <change_name>

# apply existing migrations (deploy/runtime envs)
pnpm prisma migrate deploy

# regenerate client
pnpm prisma generate
```

## Supabase notes

- Runtime DB access uses `DATABASE_URL`.
- Migrations prefer `DIRECT_URL` when available.
- Storage operations are done server-side with `SUPABASE_SERVICE_ROLE_KEY`.

See [architecture.md](./architecture.md) for module and API interactions.
