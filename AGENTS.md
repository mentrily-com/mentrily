# AGENTS.md — Mentrily Autonomous Agent Operating Contract

This document defines the strict operating rules, engineering standards, and architectural conventions for all AI agents (including Ralph iterations using the `agy` CLI) working on the Mentrily codebase.

---

## 1. Core Operating Principles

1. **Existing MVP First**: Mentrily is an established, operating application. NEVER treat this as a greenfield project. Never rewrite working functionality or replace stacks without explicit, documented architectural justification.
2. **Inspect Before Modifying**: Always read and understand the existing component, service, schema, and tests before making changes.
3. **Minimal, Maintainable Changes**: Make surgical edits. Avoid unnecessary churn in unrelated files or arbitrary refactoring.
4. **Follow Project Conventions**: Respect existing TypeScript, NestJS, and Next.js design patterns, formatting rules, and folder structures.
5. **Zero Tolerance for Security Compromises**:
   - Never commit secrets, credentials, or `.env` files.
   - Never bypass authorization guards (`ClerkAuthGuard`, `RolesGuard`, `PlanGuard`).
   - Never weaken or disable security checks just to make tests pass.
   - Strictly maintain tenant isolation (all queries must scope to `orgId` where applicable).
   - Sanitize all outputs (never leak answer keys or hidden tests to learners).
6. **Verifiable Quality & Evidence**:
   - Never mark a story or task complete without executable evidence.
   - Every completed story must pass typechecks, linters, and relevant unit/integration/E2E tests.
   - For UI stories, visual and functional verification in browser tooling is mandatory.
7. **Database Migration Discipline**:
   - All Prisma migrations must be idempotent, reproducible, and tested (`prisma migrate dev` or `prisma migrate deploy`).
   - Use `IF NOT EXISTS` for raw SQL indexes.
   - Always maintain backward compatibility with running instances.

---

## 2. Git & Commit Rules

Every iteration implements **exactly one user story**:
1. Verify prerequisites and dependencies in `prd.json`.
2. Inspect target files.
3. Implement changes.
4. Run project quality gates.
5. Verify acceptance criteria with real checks.
6. Commit using the exact semantic format:
   ```bash
   git add <specific-files>
   git commit -m "feat: [Story ID] - [Story Title]"
   ```
7. Update `prd.json` to mark `"passes": true`.
8. Append progress details and learnings to `progress.txt`.
9. Document any discovered codebase patterns in this file or local module notes.

---

## 3. Codebase Quality Gates

Before committing, run the relevant checks:

| Subsystem | Command |
| :--- | :--- |
| **Backend Typecheck** | `npm run typecheck --prefix backend` |
| **Backend Lint** | `npm run lint --prefix backend` |
| **Backend Unit Tests** | `npm test --prefix backend -- --passWithNoTests` |
| **Backend E2E Tests** | `npm run test:e2e --prefix backend` |
| **Frontend Typecheck** | `npm run typecheck --prefix frontend` |
| **Frontend Lint** | `npm run lint --prefix frontend` |
| **Frontend E2E Tests** | `npm run test:e2e --prefix frontend` |
| **Prisma Validation** | `cd backend && npx prisma validate` |
| **Full Workspace Check** | `npm run check` |

---

## 4. Architectural Patterns & Directory Map

```text
blockscode/
├── backend/
│   ├── src/
│   │   ├── main.ts                    # Fastify adapter bootstrap (port 4000, 600MB body limit)
│   │   ├── app.module.ts              # Root NestJS module (Redis, BullMQ, Throttler)
│   │   ├── modules/
│   │   │   ├── auth/                  # Clerk JWT auth, session management, roles
│   │   │   ├── admin/                 # Org admin endpoints & user management
│   │   │   ├── ai/                    # AI Studio, draft generation, credits, OmniRoute
│   │   │   ├── billing/               # Stripe customer & webhook handling
│   │   │   ├── certificate/           # PDF certificate generation & QR verification
│   │   │   ├── code-execution/        # Judge0 / Piston execution strategies
│   │   │   ├── course/                # Course CRUD, syllabus, video uploads
│   │   │   ├── exam/                  # Exam creation, questions, rotating test codes
│   │   │   ├── monitoring/            # Real-time WebSocket proctoring & room presence
│   │   │   ├── student/               # Learner dashboard, progress, bookmarks
│   │   │   ├── submission/            # BullMQ submission queue & scoring processors
│   │   │   ├── super-admin/           # Platform-level multi-tenancy & billing
│   │   │   ├── teacher/               # Creator courses, exams, announcements, groups
│   │   │   └── uploads/               # S3/Spaces file uploads & signed URLs
│   │   └── services/
│   │       ├── prisma/                # PrismaService database client
│   │       └── storage/               # DigitalOcean Spaces / S3 storage service
│   └── prisma/
│       └── schema.prisma              # Database models, enums, composite indexes
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout with OrganizationProvider & ToastProvider
│   │   ├── (app)/
│   │   │   ├── dashboard/             # Role-based dashboards (learner, creator, super-admin)
│   │   │   ├── exam/                  # Exam-taking environment (timer, proctoring, editor)
│   │   │   ├── playground/            # Public multi-language online code editor
│   │   │   └── [orgSlug]/             # Multi-tenant custom domain / slug routing
│   │   ├── (marketing)/               # Public landing, pricing, about, AI showcase
│   │   └── components/                # Reusable UI components (UnitRenderer, SplitPane, etc.)
│   └── services/api/                  # Frontend API service layer (AuthService, ExamService, etc.)
│
├── docs/                              # Technical architecture, PRD, ADRs, QA docs
├── tasks/                             # PRD specifications and story definitions
└── scripts/ralph/                     # Autonomous loop runner (ralph.sh, agy-runner.sh)
```

---

## 5. Security & Isolation Guidelines

- **Multi-Tenant Scoping**: All queries accessing tenant-specific data (`Course`, `Exam`, `StudentGroup`, `Announcement`, `Certificate`) must include `orgId` filtering.
- **Fail-Closed Assessment Data**: When fetching exam questions for learners, answers, solutions, and hidden test cases must be stripped before sending to the client.
- **Code Execution Sandboxing**: Student code execution must always run in an isolated execution engine (Judge0) with network disabled, execution timeouts enforced, and memory limits capped.
- **Upload Constraints**: Validate MIME types, extensions, and file sizes (5MB for images, 500MB for course videos). Never derive S3 keys directly from untrusted input.
- **Token Handling**: Auth tokens are passed via HttpOnly cookies and `Authorization: Bearer` headers. Clerk user tokens are validated on every request.

---

## 6. Documented Gotchas & Patterns

- **Judge0 Engine**: Production requires HTTPS for `JUDGE0_API_URL` when connecting across public networks to prevent bearer token leakage.
- **Exam Session Termination**: If a session status is `TERMINATED` or `COMPLETED`, background sweepers and student submissions must never overwrite the status.
- **Fastify & Next Proxy**: Large video uploads bypass the Next.js API proxy to prevent Vercel 4.5MB request payload errors; they upload directly to `/api/courses/videos` with Bearer auth.
- **Prisma Composite Indexes**: Use `@@index` annotations matching query filter and order paths to maintain sub-100ms response times.
- **Prisma Client Generation**: Whenever modifying `backend/prisma/schema.prisma`, execute `npx prisma generate` inside `backend/` to regenerate types for `@prisma/client`.
- **NPM Peer Dependencies**: When installing dependencies in `backend/` or `frontend/`, use `--legacy-peer-deps` if peer conflicts occur with NestJS / Fastify plugins.
