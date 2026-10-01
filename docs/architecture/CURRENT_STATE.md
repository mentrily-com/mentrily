# Mentrily System Current State & Technical Reality

## 1. System Overview

**Mentrily** (formerly *BlocksCode*) is a multi-tenant, cloud-based educational management and examination SaaS platform. It connects educational organizations, course creators/teachers, and learners. The platform facilitates:
- Course creation and structured modular content delivery (Readings, MCQs, Multi-selects, Sandboxed Code challenges, Interactive Web apps, and Python Notebooks).
- Rigorous timed and proctored examination workflows with auto-submission, live proctoring telemetry, tab-switch / VM detection, rotating test codes, and automated test-case evaluation.
- An AI Studio and AI-assisted authoring suite (course outline generation, quiz generation, blueprint generation, and in-place content editing via OmniRoute).
- Multi-tenancy isolation supporting white-labeled organization slugs, custom domains, role management, seat quotas, and subscription tiers.

---

## 2. Frontend Architecture

### 2.1 Framework & Core Stack
- **Framework**: Next.js 14+ using the App Router (`frontend/app/`).
- **Language**: TypeScript (strict mode enabled in `tsconfig.json`).
- **Styling**: Tailwind CSS (`tailwind.config.ts`), PostCSS, CSS Custom Properties (`globals.css`), Lucide React icons, and Framer Motion for animations.
- **Rich Text & Code Editing**:
  - Tiptap / ProseMirror for rich text authoring.
  - Monaco Editor and CodeMirror 6 for multi-language code editing (`frontend/app/components/Editor/`).
  - Pyodide / Jupyter notebook emulation for in-browser Python execution.
- **Client State & Data Fetching**:
  - React Query (`@tanstack/react-query`) via `QueryProvider.tsx` for server-state caching, optimistic updates, and background revalidation.
  - React Context API for localized global state (`OrganizationContext`, `ToastProvider`, `PostHogProvider`).
  - Native `fetch` wrapper in `frontend/services/api/` with automatic authentication headers, Clerk token injection, and active organization scoping (`X-Active-Org-Id`).

### 2.2 Layout & Routing Structure
- **`(marketing)` Group**: Public-facing marketing pages (`/`, `/about`, `/pricing`, `/ai`, `/partnership`, `/contact`, `/terms`, `/privacy`).
- **`(app)` Group**: Authenticated application surface:
  - `/dashboard/learner/*`: Browse courses, track enrolled progress, view certificates, review test attempts, and study units.
  - `/dashboard/creator/*`: Course builder, exam builder, AI drawer, student groups, announcements, analytics, and billing.
  - `/dashboard/super-admin/*`: Global organization registry, user administration, subscription overrides, system health.
  - `/exam/[slug]`: Dedicated, distraction-free proctored exam runtime.
  - `/playground`: Standalone public/authenticated multi-language coding playground.
  - `/[orgSlug]`: Dynamic tenant portal routing with custom branding and organization scoping.

### 2.3 UI Components & Design System
- **Layout Shell**: `AppShell.tsx`, `DashboardSidebar.tsx`, `DashboardTopbar.tsx`, `SplitPane.tsx`.
- **Content Delivery**: `UnitRenderer.tsx` handles dynamic rendering of all educational unit types (Reading, MCQ, Coding, Web, Notebook) with code-splitting and dynamic imports (`ssr: false`).
- **Skeleton Screens**: Complete skeleton loading states in `frontend/app/components/Skeletons/` avoiding layout reflows during async data fetching.
- **Accessibility & Modals**: `useModalA11y.ts` focus trapping, ARIA live announcement regions, and custom non-blocking Toast alerts.

---

## 3. Backend Architecture

### 3.1 Framework & Server Bootstrap
- **Framework**: NestJS 10+ with the `@nestjs/platform-fastify` HTTP adapter (`backend/src/main.ts`).
- **Runtime Port**: Port 4000 with a global route prefix `/api`.
- **Payload Limits**: Fastify configured with a **600MB body limit** and `fastify-multipart` configured with a **500MB file limit** to allow direct, high-bandwidth video uploads to the backend.
- **CORS & Compression**: Dynamic origin validation supporting `*.mentrily.com`, `*.blockscode.me`, and local development origins, with gzip/brotli compression.

### 3.2 Modular Domain Structure
The backend is organized into decoupled feature modules (`backend/src/modules/`):
- `auth`: Clerk JWT validation, session issuance, role checking, password verification for exam lockdown.
- `admin`: Organization-level member management, seat allocation, and course assignment.
- `ai`: AI Studio orchestration, AI job queue, credit tracking, provider routing (OmniRoute), and drafting services.
- `billing`: Stripe billing integration, checkout sessions, customer portal, and subscription webhooks.
- `certificate`: Cryptographically signed PDF certificate generation, template rendering, and public QR code verification.
- `code-execution`: Sandboxed multi-language code execution using the Strategy pattern (`Judge0Strategy`, `PistonStrategy`).
- `course`: Course curriculum management, module hierarchy, unit definition, and video asset streaming.
- `exam`: Exam authoring, questions schema, rotating access codes, duration constraints, and scheduling.
- `monitoring`: WebSocket gateway for real-time exam telemetry, student heartbeat tracking, tab-switch violations, and instructor live supervision.
- `student`: Learner dashboards, unit submissions, bookmarks, course progress calculation, and daily streak tracking.
- `submission`: Asynchronous submission processing with BullMQ and automated score calculation.
- `super-admin`: Platform tenant orchestration, global billing overviews, and system settings.
- `teacher`: Specialized instructor operations (decomposed into Courses, Exams, Stats, Groups, Announcements, Students).
- `uploads`: DigitalOcean Spaces / AWS S3 presigned URL generation, file validation, and asset metadata persistence.

---

## 4. Database & Persistence Layer

### 4.1 Technology & Tooling
- **Engine**: PostgreSQL hosted on Supabase (with direct connection pooling via `SUPABASE_DIRECT_URL`).
- **ORM**: Prisma ORM (`@prisma/client` 5.x) located in `backend/prisma/schema.prisma`.
- **Migrations**: 35+ incremental migrations under `backend/prisma/migrations/`.

### 4.2 Core Data Models
- **Identity & Tenancy**: `User`, `Organization`, `OrgMembership`, `PendingInvite`, `AuditLog`.
- **LMS & Courses**: `Course`, `CourseModule`, `Unit`, `CourseProgress`, `UnitSubmission`, `CourseAssignment`, `Bookmark`.
- **Exams & Assessments**: `Exam`, `ExamSession`, `Violation`, `QuestionAttempt`, `Feedback`, `CourseTest`, `PublicCodingQuestion`.
- **AI Infrastructure**: `AiUsage`, `AiConversation`, `AiMessage`, `AiJob`.
- **Certificates & Assets**: `Certificate`, `CertificateTemplate`, `Asset`.
- **Billing & Auditing**: `UsageLedger`, `SubscriptionEvent`, `WebhookEndpoint`, `BugReport`.

### 4.3 Composite Indexes & Query Optimization
Recent optimizations added composite indexes for hot-path queries:
- `ExamSession(userId, examId, status)`
- `UnitSubmission(userId, unitId, status)`
- `Course(orgId, status, updatedAt)`
- `Violation(sessionId, timestamp)`
- `AiJob(userId, status, createdAt)`

---

## 5. Authentication & Multi-Tenancy

### 5.1 Authentication Flow
- **Primary Auth**: Clerk integration (`@clerk/nextjs` on frontend, `ClerkAuthGuard` and `JwtStrategy` on backend).
- **Session Resolution**: Requests supply Clerk session tokens. The backend extracts `clerkId`, checks cache, and resolves the database `User` record.
- **Password Fallback**: Exams enforce an additional bcrypt password verification step for added proctoring integrity.

### 5.2 Multi-Tenancy & Workspace Switching
- **Model**: Users belong to a primary "home" organization via `User.orgId`, but can simultaneously hold memberships in multiple organizations via `OrgMembership`.
- **Resolution**:
  1. `X-Active-Org-Id` HTTP header.
  2. Fallback to `User.lastActiveOrgId`.
  3. Fallback to `User.orgId`.
- **Data Scoping**: Tenant-specific queries strictly filter by `orgId` to ensure total isolation between colleges, academies, and enterprises.

---

## 6. Exam & Assessment Engine

### 6.1 Question Formats
1. **MCQ (Single Select)**: Radio selection, automatic grading.
2. **MultiSelect**: Multi-checkbox selection with partial or all-or-nothing scoring.
3. **Reading**: HTML/Markdown text, embedded YouTube segments, code snippets.
4. **Coding**: Multi-language code editor, standard input (stdin), public test cases, and hidden verification test cases evaluated against sandboxed execution engines.
5. **Web Development**: HTML, CSS, JavaScript split-view live preview.
6. **Notebook**: Interactive Python notebook with cell-by-cell execution.

### 6.2 Exam Security & Proctoring
- **Anti-Cheat Controls**:
  - Browser fullscreen locking and blur/tab-switch event detection.
  - WebRTC / WebSocket live heartbeat transmission to instructor monitor.
  - Virtual Machine (VM) and headless browser detection heuristics.
  - Rotating test access codes (auto-regenerating on configurable intervals).
  - Sanitized student payloads: Hidden test cases and answers are completely stripped from student-facing API endpoints.
- **Session Lifecycle**:
  - `IN_PROGRESS` -> `COMPLETED` or `TERMINATED`.
  - Automated deadline sweeper auto-submits abandoned sessions past expiration.
  - Protection against race conditions prevents terminated sessions from being overwritten.

---

## 7. Code Execution Sandboxing

- **Primary Engine**: **Judge0 CE** deployed on dedicated cloud infrastructure (`https://judge.mentrily.com`).
- **Transport Safety**: Backend validates that production connections strictly use HTTPS to protect the `X-Auth-Token` bearer credential.
- **Resource Limits**:
  - CPU time limit: 5 seconds.
  - Wall time limit: 20 seconds.
  - Memory limit: 256,000 KB (256 MB).
  - Outbound networking: Disabled (`enable_network: false`).
- **Supported Languages**: 30+ compilers and runtimes (Python 3.12, Node.js 22, C/C++ GCC 13, Java 17, Go 1.22, Rust 1.81, TypeScript 5.6, C# Mono, Kotlin, Swift, etc.).
- **Fallback**: Secondary Piston API strategy maintained for dev environments.

---

## 8. AI System & Content Generation

- **Architecture**:
  - Multi-tier model routing via OmniRoute and direct LLM providers.
  - Async job queue (`AiJob`) for long-running generation tasks (curriculum blueprints, full exam generation).
  - Credit tracking (`AiUsage`) scoped to organization or individual creator tiers with quota deductions.
  - Interactive AI Studio chat interface with persistent message history (`AiConversation`, `AiMessage`).
- **Targeted AI Editing**: Inline course unit modifications and question refinement tools.

---

## 9. Infrastructure, Background Jobs & Storage

- **Cache & Message Broker**: Redis instance handling session caching, rate-limit counters, and BullMQ queues (`submission`, `ai-jobs`).
- **Object Storage**: DigitalOcean Spaces / AWS S3 bucket for media assets, student code attachments, and generated certificate PDFs.
- **CDN**: CloudFront CDN in front of storage buckets for fast video and asset streaming.
- **Observability**: Datadog APM (`dd-trace`) integrated in `backend/src/main.ts` and `tracer.ts`.

---

## 10. Known Technical Debt, Gaps & Risks

1. **Test Coverage Gaps**:
   - Backend unit test coverage is concentrated in auth and code execution, but minimal in course management and billing.
   - Frontend lacks end-to-end integration tests for the full exam submission lifecycle and multi-tenancy workspace switching.
2. **Autonomous Execution Tooling**:
   - Upstream Ralph was coupled with Amp and Claude Code CLI tools; required native adaptation to Google Antigravity `agy` CLI.
3. **Database Drift & Migration Hygiene**:
   - Historical columns (`bug_report_status`, `timeTakenSec`) have minor enum naming drift requiring idempotent SQL scripts.
4. **Realtime WebSocket Reconnection**:
   - In flaky network conditions during exams, WebSocket reconnect backoff requires resilient heartbeat buffering.
