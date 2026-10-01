# Product Requirements Document (PRD): Mentrily Production Platform V2

**Document Version:** 2.1.0-PROD  
**Target Codebase Location:** `mentrily-production/`  
**Execution Runtime:** Ralph Autonomous Development Loop + Antigravity (`agy`)  
**Design Standard:** Linear + Maven Hybrid  
**Status:** Approved for Autonomous Implementation  

---

## 1. Executive Summary

**Mentrily V2** is an enterprise-grade, multi-tenant learning management (LMS), computer-based testing, and educational resource management platform. This release elevates Mentrily to industry-leading standards with:
1. **Complete UI/UX Overhaul**: An immaculate, high-density Linear + Maven hybrid design system featuring 100% route coverage of pixel-matched loading skeletons, eliminating all layout shifts and visual inconsistencies.
2. **Open-Source ERP Integration (ERPNext / Frappe)**: Bi-directional synchronization of students, courses, attendance, and fee invoices, complete with a direct SSO launchpad into ERPNext Desk.
3. **Developer Platform & Admin Webhooks**: Scoped API key issuance and HMAC-SHA256 signed outbound webhooks with automated retries and delivery telemetry.
4. **Partner Dashboard**: A dedicated portal (`/dashboard/partner`) for channel partners, academic resellers, and affiliates to manage cohorts, track referrals, and inspect revenue-share commissions.
5. **Enhanced Super Admin Control Plane**: Advanced platform oversight including real-time infrastructure telemetry, instant tenant impersonation for customer support, and global banner broadcasts.

All production implementation will be developed in the dedicated root folder `mentrily-production/`.

---

## 2. Product Vision & Competitive Benchmark

### 2.1 Benchmark Analysis of Leading Educational & SaaS Platforms
- **Linear**: High-density data tables, hairline borders (`border-slate-800`), sub-second keyboard shortcuts, dark slate palette, and subtle micro-interactions.
- **Maven**: Pedagogical elegance, prominent course syllabus milestones, engaging instructor bios, and cohort community threads.
- **Coursera & Educative**: Structured multi-language split-pane code runners, verified certificate badges, and distraction-free exam environments.
- **Canvas / Moodle**: Institutional grade multi-tenancy, gradebooks, and student information system (SIS/ERP) interoperability.

Mentrily V2 combines the aesthetic polish of Linear and Maven with the robust assessment and enterprise capabilities of Canvas and Educative.

---

## 3. User Personas & Permissions

| Persona | Primary Interface | Core Responsibilities |
| :--- | :--- | :--- |
| **Learner (Student)** | `/dashboard/learner` | Study interactive units, run code in sandboxed editors, take proctored exams, earn verified certificates. |
| **Creator / Teacher** | `/dashboard/creator` | Author courses with AI Studio, design exams, supervise live candidates, perform manual grading overrides. |
| **Organization Admin** | `/dashboard/creator/settings` & `/developer` | Manage institutional seats, configure custom domains, generate API keys, subscribe to webhooks, sync ERPNext. |
| **Channel Partner** | `/dashboard/partner` | Monitor referred cohorts, track student conversion, review commission earnings, generate co-branded invite links. |
| **Platform Super Admin** | `/dashboard/super-admin` | Global multi-tenant administration, infrastructure telemetry, tenant impersonation, global broadcasts. |

---

## 4. End-to-End User Journeys

### 4.1 Enterprise Student Enrollment & ERP Synchronization
1. Institution registers a new student batch in ERPNext Education.
2. ERPNext webhook notifies Mentrily's `POST /api/webhooks/erp`.
3. Mentrily automatically creates user accounts, provisions `OrgMembership`, and enrolls them into designated courses.
4. Student logs in via Clerk, lands on the polished Linear-style Learner Dashboard with zero layout shift (skeleton match), and starts studying.

### 4.2 Proctored Exam with Offline Resilience & Live Supervision
1. Student enters `/exam/[slug]`. Client initialises fullscreen lock and IndexedDB buffer.
2. Student submits answers; each answer is stored in IndexedDB instantly and synced to backend.
3. Instructor opens `/dashboard/creator/exams/[id]/monitor` to view live candidate status cards, active question indices, and real-time violation logs.
4. On exam completion, automated grading calculates scores, generates certificates with QR verification, and pushes final grades back to ERPNext.

### 4.3 Admin Webhook & API Key Developer Workflow
1. Organization Admin navigates to `/developer/webhooks`.
2. Admin registers endpoint `https://api.acme.edu/mentrily-events` subscribed to `exam.completed` and `certificate.issued`.
3. Admin clicks "Send Test Ping" and inspects the live HMAC signature and response payload in the delivery log viewer.
4. Admin generates a scoped API key (`men_live_...`) to automate student gradebook sync into their internal systems.

### 4.4 Channel Partner Cohort Management
1. Partner logs into `/dashboard/partner`.
2. Partner creates a tracking link for "Spring 2027 Full-Stack Bootcamp".
3. Dashboard displays active cohort registrations, completion percentages, and accrued revenue commissions with exportable CSV statements.

---

## 5. Functional Requirements

### 5.1 Linear + Maven Hybrid UI & Loading Skeleton Architecture
- **FR-UI-1**: Unified design tokens: Dark slate base (`#0f172a`), card background (`#1e293b`), crisp hairline borders (`#334155`), and brand teal accents (`#008D98`).
- **FR-UI-2**: Pixel-matched loading skeletons for 100% of routes across Learner, Creator, Partner, and Super Admin dashboards, eliminating layout shifts.
- **FR-UI-3**: High-density data tables featuring sticky headers, debounced search, multi-column sorting, pagination, and floating batch-action bars.
- **FR-UI-4**: SplitPane component with persistent drag-width memory saved in browser localStorage.

### 5.2 Open-Source ERP Integration (ERPNext / Frappe)
- **FR-ERP-1**: Bi-directional sync service connecting Mentrily with ERPNext REST API:
  - `Mentrily User (Student)` $\leftrightarrow$ `ERPNext Student`
  - `Mentrily Course` $\leftrightarrow$ `ERPNext Course & Program`
  - `Mentrily CourseProgress` $\leftrightarrow$ `ERPNext Program Enrollment & Attendance`
  - `Mentrily Subscription / Fee` $\leftrightarrow$ `ERPNext Sales Invoice / Fee Schedule`
- **FR-ERP-2**: ERP Webhook listener (`POST /api/webhooks/erp`) validating HMAC signatures from Frappe DocType hooks.
- **FR-ERP-3**: One-click launchpad button in Admin topbar opening the tenant's ERPNext Desk via pre-authenticated token.

### 5.3 Admin Webhooks & Developer API
- **FR-DEV-1**: Outbound webhook dispatcher transmitting events (`exam.completed`, `course.completed`, `certificate.issued`, `student.enrolled`).
- **FR-DEV-2**: Payload signing using `HMAC-SHA256` in header `X-Mentrily-Signature: t={timestamp},v1={hash}`.
- **FR-DEV-3**: Automatic retry policy with exponential backoff (up to 5 retries) and full request/response delivery logs.
- **FR-DEV-4**: Scoped API key generator (`men_live_...`) with permission scopes (`exams:read`, `exams:write`, `students:read`) and Redis rate limiting.

### 5.4 Partner Dashboard & Affiliate Management
- **FR-PRT-1**: Dedicated `/dashboard/partner` interface displaying referral statistics, student cohorts, and revenue share earnings.
- **FR-PRT-2**: Dynamic tracking link generation with custom UTM parameters and attribution cookies.
- **FR-PRT-3**: Payout ledger tracking paid vs pending commissions with downloadable invoices.

### 5.5 Super Admin Control Plane
- **FR-SUP-1**: Real-time platform infrastructure monitor (Judge0 queue length, Redis memory saturation, active WebSocket sockets).
- **FR-SUP-2**: One-click tenant impersonation allowing Super Admins to view an organization as an Admin for support triage.
- **FR-SUP-3**: Global announcement broadcast system publishing high-priority dismissal banners across all tenant dashboards.

---

## 6. Implementation Directory Structure (`mentrily-production/`)

All code will be organized cleanly in the new production workspace:

```text
mentrily-production/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── admin/                 # Admin controllers, API key management
│   │   │   ├── erp/                   # ERPNext / Frappe sync bridge
│   │   │   ├── webhook/               # Outbound webhook worker & HMAC signer
│   │   │   ├── partner/               # Partner analytics & referral tracking
│   │   │   ├── super-admin/           # Platform control plane & impersonation
│   │   │   ├── exam/                  # Hardened exam engine & proctoring
│   │   │   └── code-execution/        # Judge0 HTTPS client & rate limiter
│   │   └── prisma/
│   │       └── schema.prisma          # Database models with Webhook, ERP, Partner entities
│
├── frontend/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── dashboard/
│   │   │   │   ├── learner/           # Linear+Maven learner dashboard & courses
│   │   │   │   ├── creator/           # Redesigned course/exam builder & AI studio
│   │   │   │   ├── partner/           # Dedicated Partner & Affiliate portal
│   │   │   │   └── super-admin/       # Advanced control plane & tenant switcher
│   │   │   ├── developer/             # API keys, interactive docs & webhook manager
│   │   │   └── exam/[slug]/           # Distraction-free exam room with IndexedDB
│   │   └── components/
│   │       ├── Skeletons/             # 100% pixel-matched skeletons for EVERY view
│   │       └── ui/                    # Linear+Maven design system library
│
└── erp-connector/                     # Dedicated Frappe / ERPNext bridge package
    ├── src/
    │   ├── client.ts                  # Frappe REST API client
    │   ├── mappers.ts                 # DocType schema converters
    │   └── webhook-receiver.ts        # Incoming DocType event processor
    └── package.json
```

---

## 7. Definition of Done (DoD)

Each implementation story is verified against:
1. **Design System Adherence**: Conforms to Linear + Maven aesthetic standards (hairline borders, dark slate cards, refined typography).
2. **Skeleton Match**: Page loading state visually mirrors loaded content geometry with zero layout reflows.
3. **Quality Gates**: Backend and frontend typechecks, linters, and unit tests pass with zero warnings.
4. **Browser Verification**: Tested interactively using browser tooling.
5. **Git Discipline**: Committed with exact semantic message (`feat: [Story ID] - [Story Title]`).
