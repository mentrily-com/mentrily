# Mentrily

Mentrily is a full-stack learning, assessment, and coding-exam platform for organizations that need to create courses, run exams, manage learners, monitor submissions, and issue certificates from one product.

Built and maintained by **Suman Yadav**.

## What This Repository Contains

This is a monorepo with a Next.js frontend and a NestJS backend.

```text
.
├── frontend/   # Next.js app, dashboard UI, marketing pages, exam experience
├── backend/    # NestJS API, Prisma schema, Supabase migrations, workers
└── package.json
```

The root `package.json` provides workspace-level commands that delegate to both apps.

## Product Overview

Mentrily is designed around three major workflows:

- **Learning management**: create courses, structure modules and units, publish learning content, and give learners a focused dashboard.
- **Assessment and exams**: build exams with coding, MCQ, reading, notebook, and web-based question types; invite candidates; monitor attempts; and review results.
- **Organization operations**: manage organizations, roles, users, billing limits, certificates, onboarding, notifications, and super-admin controls.

## Main Capabilities

- Organization-scoped dashboards for admins, creators, learners, and super admins
- Course and exam builders with AI-assisted generation flows
- Coding execution integrations and playground experiences
- Real-time exam monitoring through WebSockets
- Clerk-based authentication and invitation flows
- Supabase-backed schema, RPC, RLS policies, and verification tests
- Prisma data model and database migrations
- Billing, quota, plan, and organization limit services
- Certificate templates, verification pages, and certificate generation
- Sentry/PostHog/Crisp integration points for observability, analytics, and support

## Tech Stack

**Frontend**

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Apollo Client and GraphQL
- TanStack Query
- Clerk authentication
- Socket.IO client

**Backend**

- NestJS 11
- Fastify
- TypeScript
- Prisma
- Supabase
- PostgreSQL
- BullMQ and Redis
- Socket.IO
- Stripe
- Clerk backend SDK

## Getting Started

Install dependencies in each app:

```bash
npm install --prefix frontend
npm install --prefix backend
```

Run the frontend:

```bash
npm run dev --prefix frontend
```

Run the backend:

```bash
npm run start:dev --prefix backend
```

The frontend normally runs at:

```text
http://localhost:3000
```

## Common Commands

Run checks for both apps:

```bash
npm run check
```

Run full validation for both apps:

```bash
npm run check:full
```

Build both apps:

```bash
npm run build
```

Format both apps:

```bash
npm run format
```

## Environment Configuration

Environment variables are intentionally not committed. Use local `.env` files inside `frontend/` and `backend/`.

Important backend integrations include:

- Database URLs for Prisma and Supabase
- Clerk secret keys and webhook secrets
- Supabase URL, anon key, and service role key
- Redis/BullMQ configuration
- Stripe keys
- Mail and storage provider credentials

Important frontend integrations include:

- Public API base URLs
- Clerk public keys
- Supabase GraphQL URL and anon key
- Analytics/support provider IDs

See `backend/README.md` and `frontend/README.md` for app-specific notes.

## Database And Supabase

The backend contains both Prisma migrations and Supabase SQL migrations.

Useful backend commands:

```bash
npm run supabase:deploy --prefix backend
npm run supabase:rls:tokens --prefix backend
npm run seed:college-demo --prefix backend
```

Supabase migration and data-migration scripts live under:

```text
backend/supabase/
```

## Repository Status

This repository is connected to:

```text
https://github.com/mentrily-com/mentrily.git
```

The previous `blockscodeX` remote is kept separately as `origin` in the local working copy and should not be used for Mentrily pushes.

## Author

**Suman Yadab**

