# Backend Tech Stack

This document outlines the core technologies, libraries, and tools used in the `expenses-tracking-backend` application.

## Core Framework
- **[NestJS](https://nestjs.com/) (v11)**: A progressive Node.js framework for building efficient, reliable, and scalable server-side applications.
- **[Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/)**: The runtime environment and language used, leveraging strong typing and modern JavaScript features.

## Database, ORM & Cloud Services
- **[Supabase](https://supabase.com/)**: The core cloud infrastructure providing the PostgreSQL database, Authentication (JWT), and other backend services.
- **[Prisma](https://www.prisma.io/) (v7.8)**: Next-generation Node.js and TypeScript ORM used for type-safe database access, schema management, and migrations, connecting directly to the Supabase PostgreSQL database.

## Authentication & Security
- **[Passport](https://www.passportjs.org/)**: Authentication middleware for Node.js used in conjunction with NestJS.
- **[Passport JWT](https://github.com/mikenicholson/passport-jwt)**: A Passport strategy for authenticating with a JSON Web Token (JWT).
  - **Supabase Authentication integration**: The backend verifies JWTs that are automatically issued by the **Supabase** frontend client. By passing the `SUPABASE_JWT_SECRET` to the Passport JWT strategy, we seamlessly protect our NestJS endpoints and automatically resolve the user's Supabase context (such as ID, email, and roles) in each request.
- **[Dotenv](https://github.com/motdotla/dotenv)**: Used for loading environment variables from a `.env` file into `process.env`.

## Testing
- **[Jest](https://jestjs.io/) (v30)**: A delightful JavaScript Testing Framework with a focus on simplicity.
- **[Supertest](https://github.com/ladjs/supertest)**: Super-agent driven library for testing Node.js HTTP servers, used for end-to-end (e2e) testing.
- **[ts-jest](https://kulshekhar.github.io/ts-jest/)**: A Jest transformer with source map support that lets you use Jest to test projects written in TypeScript.

## Linting & Formatting
- **[ESLint](https://eslint.org/) (v9)**: Used for identifying and reporting on patterns in JavaScript/TypeScript.
- **[Prettier](https://prettier.io/) (v3)**: An opinionated code formatter used to ensure a consistent code style across the project.
