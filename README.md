# Mentrily

Mentrily is a full-stack learning, assessment, and coding-exam platform designed for organizations. It enables the creation of courses, execution of exams, management of learners, monitoring of submissions, and issuance of certificates from a single, unified product.

Built and maintained by **Suman Yadav**.

## 📦 What This Repository Contains

This repository is structured as a monorepo containing a Next.js frontend and a NestJS backend.

```text
.
├── frontend/   # Next.js application, dashboard UI, marketing pages, and exam interfaces.
├── backend/    # NestJS API, Prisma schema, Supabase migrations, and background workers.
└── package.json# Root configuration providing workspace-level commands.
```

The root `package.json` delegates commands to both the `frontend` and `backend` applications.

## 🌟 Product Overview

Mentrily streamlines three major organizational workflows:

- **Learning Management**: Create comprehensive courses, structure modules and units, publish learning content, and provide learners with an intuitive, focused dashboard.
- **Assessment and Exams**: Build robust exams supporting various question types (coding, MCQ, reading, notebook, web-based). Invite candidates, monitor attempts in real-time, and review detailed results.
- **Organization Operations**: Manage multi-tenant organizations, roles, users, billing limits, certificate templates, onboarding processes, notifications, and super-admin controls.

## 🚀 Main Capabilities

- **Multi-Tenant Dashboards**: Organization-scoped views tailored for admins, creators, learners, and super admins.
- **AI-Assisted Builders**: Course and exam creation flows enhanced by AI generation.
- **Coding Playground**: Integrated code execution environments for exams and practice.
- **Real-Time Monitoring**: Live exam monitoring powered by WebSockets.
- **Secure Authentication**: Robust authentication and invitation flows managed via Clerk.
- **Database & RLS**: PostgreSQL database with Supabase-backed schema, RPC, and Row Level Security (RLS) policies, fully verified by automated tests.
- **Data Modeling**: Type-safe database interactions using Prisma.
- **Billing & Quotas**: Built-in services for managing billing plans, quotas, and organization limits.
- **Certificates**: Customizable certificate templates, automated generation, and verification pages.
- **Observability**: Integrations with Sentry, PostHog, and Crisp for comprehensive observability, analytics, and user support.

## 💻 Tech Stack

### Frontend

- Next.js 16 (React 19)
- TypeScript
- Tailwind CSS
- Apollo Client & GraphQL
- TanStack Query
- Clerk Authentication
- Socket.IO Client

### Backend

- NestJS 11 (Fastify)
- TypeScript
- Prisma ORM
- Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- BullMQ & Redis
- Socket.IO
- Stripe
- Clerk Backend SDK

## 🛠️ Getting Started

### Prerequisites

Ensure you have Node.js (v18+) and npm installed.

### Installation

Install dependencies for both applications from the root directory:

```bash
npm install --prefix frontend
npm install --prefix backend
```

### Running the Application

**Start the Frontend (Development Mode):**

```bash
npm run dev --prefix frontend
```
The frontend application will be available at `http://localhost:3000`.

**Start the Backend (Development Mode):**

```bash
npm run start:dev --prefix backend
```

## ⌨️ Common Commands (Workspace Level)

Execute these commands from the root directory to run them across both applications:

- **Run basic checks (linting/typechecking):**
  ```bash
  npm run check
  ```
- **Run full validation (including tests):**
  ```bash
  npm run check:full
  ```
- **Build both applications:**
  ```bash
  npm run build
  ```
- **Format code:**
  ```bash
  npm run format
  ```

## ⚙️ Environment Configuration

Environment variables (`.env`) are intentionally excluded from version control. You must create local `.env` files within both the `frontend/` and `backend/` directories.

**Key Backend Integrations Required:**
- `DATABASE_URL` and `DIRECT_URL` (for Prisma and Supabase connections)
- Clerk Secret Keys & Webhook Secrets
- Supabase URL, Anon Key, and Service Role Key
- Redis/BullMQ Configuration URLs
- Stripe Secret Keys
- Mail and Storage Provider Credentials

**Key Frontend Integrations Required:**
- Public API Base URLs
- Clerk Publishable Keys
- Supabase GraphQL URL and Anon Key
- Analytics/Support Provider IDs

*For detailed, app-specific configuration notes, please refer to `backend/README.md` and `frontend/README.md`.*

## 🗄️ Database And Supabase Management

The backend utilizes both Prisma for data modeling and Supabase SQL for migrations and RLS.

**Useful Database Commands (Run from root):**

Deploy Supabase schemas, RPCs, and RLS policies:
```bash
npm run supabase:deploy --prefix backend
```

Generate RLS test tokens:
```bash
npm run supabase:rls:tokens --prefix backend
```

Seed the database with demo data:
```bash
npm run seed:college-demo --prefix backend
```

*Note: Supabase migration and data-migration scripts are located in `backend/supabase/`.*

## 🔗 Repository Status

This repository is tracked at:
```text
https://github.com/mentrily-com/mentrily.git
```
*(The legacy `blockscodeX` remote is maintained separately as `origin` in local working copies and should not be used for pushing Mentrily updates.)*

## 👤 Author

**Suman Yadab**
