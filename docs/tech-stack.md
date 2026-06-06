# Backend tech stack

## Runtime and framework

- Node.js 24.16
- TypeScript 5.7
- NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)

## API layer

- GraphQL Code First via:
  - `@nestjs/graphql`
  - `@nestjs/apollo`
  - `@apollo/server`
  - `@as-integrations/express5`
  - `graphql`
- REST endpoints for smoke checks and multipart upload.

## Persistence and data

- Supabase PostgreSQL
- Prisma 7:
  - `@prisma/client`
  - `prisma`
  - `@prisma/adapter-pg`
  - `pg`

## Authentication

- Supabase Auth JWT verification
- `passport`
- `passport-jwt`
- `@nestjs/passport`
- `jwks-rsa`

## AI and content generation

- `openai` SDK against DeepSeek-compatible endpoint (`https://api.deepseek.com`)
- Used for:
  - onboarding template generation
  - expense text analysis
  - receipt expense extraction from OCR text (`DEEPSEEK_VISION_MODEL`, defaults to `deepseek-chat`)

## Receipt OCR and image processing

- `sharp` — receipt image preprocessing (contrast, scaling, variants for OCR)
- `tesseract.js` — OCR worker (`ReceiptOcrService`); language packs `eng.traineddata` / `pol.traineddata` at repo root
- Configurable via `RECEIPT_OCR_LANG` (default `eng+pol`)
- Native builds allowed in `pnpm-workspace.yaml` (`allowBuilds: sharp`, `tesseract.js`)

## Integrations

- Supabase Storage REST API via `axios` (service role key in `SupabaseStorageService`)
- Nextcloud WebDAV client: `webdav`
- Brevo email API client: `axios`
- Multipart upload handling: `multer`

## Config and env

- `@nestjs/config`
- `dotenv`

## Testing and quality

- Jest 30 (`jest`, `ts-jest`)
- Supertest (`supertest`)
- ESLint 9 + TypeScript ESLint
- Prettier 3

## Notes

- Package manager: `pnpm`
- Prisma client output: `src/generated/prisma`
- GraphQL schema output: `src/schema.gql` (generated; do not hand-edit)
