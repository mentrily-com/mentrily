# ADR 001: Evolution of the Existing Full-Stack Architecture

## Status
Accepted

## Context
Mentrily has an established, functioning MVP consisting of a Next.js 14+ frontend, NestJS with Fastify backend, PostgreSQL with Prisma ORM, Redis with BullMQ, and Judge0 code execution. The platform is not a greenfield project; rewriting or switching stacks (e.g. migrating from NestJS to Go or Express, or Next.js to Vite) would introduce massive regressions, invalidate 35+ database migrations, and destroy existing user flows.

## Decision
We strictly evolve the existing technology stack. We retain:
- Next.js (App Router) for frontend and SSR.
- NestJS on Fastify for backend API services.
- PostgreSQL + Prisma ORM for relational persistence.
- Redis + BullMQ for queues, rate-limiting, and caching.
- Judge0 CE for sandboxed code execution.

All enhancements must be implemented within this established stack.

## Consequences
- **Positive**: Zero downtime migration risk, preservation of existing business logic, rapid feature development.
- **Negative**: Must maintain NestJS Fastify compatibility (avoiding Express-specific middleware assumptions).
