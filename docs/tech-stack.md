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

## Integrations

- Supabase Storage client: `@supabase/supabase-js`
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
