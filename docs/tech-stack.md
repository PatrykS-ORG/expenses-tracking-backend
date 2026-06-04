# Backend Tech Stack

This document outlines the core technologies, libraries, and tools used in the `expenses-tracking-backend` application.

## Core Framework
- **[NestJS](https://nestjs.com/) (v11)**: A progressive Node.js framework for building efficient, reliable, and scalable server-side applications.
- **[Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/)**: The runtime environment and language used, leveraging strong typing and modern JavaScript features.

## API (GraphQL)
- **[NestJS GraphQL](https://docs.nestjs.com/graphql/quick-start) (v13)** with **[Apollo Driver](https://docs.nestjs.com/graphql/quick-start#apollo)** (`@nestjs/apollo`, `@nestjs/graphql`): Code First schema; auto-generated `src/schema.gql`.
- **[Apollo Server](https://www.apollographql.com/docs/apollo-server/) (v5)** + **[@as-integrations/express5](https://www.npmjs.com/package/@as-integrations/express5)**: HTTP integration with Express 5.
- **[GraphQL](https://graphql.org/) (v16)**: Query language for the primary application API (templates, settings).

## Database, ORM & Cloud Services
- **[Supabase](https://supabase.com/)**: PostgreSQL database and Authentication (JWT / JWKS).
- **[Prisma](https://www.prisma.io/)**: ORM and migrations — `prisma` and `@prisma/client` **v6.19** at runtime; datasource/migrate config via **`@prisma/config` v7.8** ([prisma.config.ts](../prisma.config.ts)).

## AI
- **[OpenAI Node SDK](https://github.com/openai/openai-node)**: Used against **DeepSeek** (`baseURL: https://api.deepseek.com`, model `deepseek-chat`) for HTML email template generation (`AiService`, `DEEPSEEK_API_KEY`).

## Authentication & Security
- **[Passport](https://www.passportjs.org/)**: Authentication middleware for Node.js used in conjunction with NestJS.
- **[Passport JWT](https://github.com/mikenicholson/passport-jwt)**: Bearer token extraction and validation.
- **[jwks-rsa](https://github.com/auth0/node-jwks-rsa)**: Fetches Supabase JWKS when `SUPABASE_URL` is set (ES256).
  - **Supabase Auth**: JWTs verified via `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (default). Legacy HS256 projects use `SUPABASE_JWT_SECRET` when `SUPABASE_URL` is unset.
- **[Dotenv](https://github.com/motdotla/dotenv)**: Loads environment variables from `.env` (also used by Prisma config).

## Testing
- **[Jest](https://jestjs.io/) (v30)**: A delightful JavaScript Testing Framework with a focus on simplicity.
- **[Supertest](https://github.com/ladjs/supertest)**: Super-agent driven library for testing Node.js HTTP servers, used for end-to-end (e2e) testing.
- **[ts-jest](https://kulshekhar.github.io/ts-jest/)**: A Jest transformer with source map support that lets you use Jest to test projects written in TypeScript.

## Linting & Formatting
- **[ESLint](https://eslint.org/) (v9)**: Used for identifying and reporting on patterns in JavaScript/TypeScript.
- **[Prettier](https://prettier.io/) (v3)**: An opinionated code formatter used to ensure a consistent code style across the project.
