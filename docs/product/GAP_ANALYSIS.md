# Mentrily Production Gap Analysis (V2 Expanded)

This document provides a comprehensive evaluation of current MVP capabilities against the target enterprise production platform, incorporating the UI redesign, open-source ERP integration, Admin Webhooks, Partner Dashboard, and enhanced Super Admin controls.

---

## Prioritization Matrix

- **P0 (Production Blocker)**: Core security, assessment integrity, sandbox safety, and baseline UI consistency.
- **P1 (Critical Enterprise Requirements)**: End-to-end UI overhaul with Linear+Maven design, pixel-matched loading skeletons for all pages, Admin Webhooks, Developer API, and ERPNext connector.
- **P2 (Important Business Drivers)**: Partner Dashboard, enhanced Super Admin control plane, custom domain routing, and automated retry policies.
- **P3 (Operational Polish)**: Advanced analytics, theme personalization, and SIS batch importers.

---

## Subsystem Gap Assessment

### 1. User Interface & Visual Polish (Linear + Maven Hybrid)

| Area | Current MVP State | Target Production State | Gap Category | Priority | Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Design Consistency** | Mix of custom Tailwind classes, mismatched border radii, and varying typography | Unified Linear+Maven design system with standardized 1px hairline borders, dark slate cards, and disciplined Inter/Geist type scales | Needs UX improvement | **P0** | UI improvement is the #1 requested priority; professional SaaS appearance drives institutional adoption. |
| **Loading Skeletons** | Partial coverage; some pages use generic spinners or mismatched skeleton layouts | 100% route coverage with dedicated, pixel-matched `loading.tsx` skeletons for every single view, completely eliminating layout reflows | Needs UX improvement | **P0** | Perceptual latency and visual stability are critical for high-stakes exam and dashboard workflows. |
| **Data Tables & Lists** | Basic HTML tables without sorting, dense filtering, or batch selection | High-density tables with sticky headers, multi-column sorting, debounced search, and floating batch-action drawers | Missing | **P1** | Managing hundreds of students, exams, and courses requires high-efficiency table ergonomics. |

### 2. Open-Source ERP Integration (ERPNext / Frappe)

| Area | Current MVP State | Target Production State | Gap Category | Priority | Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Student & Course Sync** | No ERP integration; manual user import via CSV | Bi-directional synchronization between Mentrily and ERPNext (Students, Courses, Programs, Attendance) | Missing | **P1** | Institutional customers require synchronization with their central open-source ERP records. |
| **Fee & Invoicing Sync** | Stripe webhooks only update Mentrily plan status | Synchronized ERPNext Sales Invoices and Fee Schedules with real-time payment webhooks | Missing | **P1** | Eliminates manual reconciliations between educational fee collection and LMS course access. |
| **Direct ERP Access** | None | One-click single-sign-on launchpad opening tenant Frappe Desk from navigation topbar | Missing | **P2** | Allows admins to switch seamlessly between LMS instruction and ERP administrative functions. |

### 3. Admin Webhooks & Developer Platform

| Area | Current MVP State | Target Production State | Gap Category | Priority | Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Webhook Delivery & HMAC Signing** | Backend `WebhookService` exists in prototype; no signing or UI | Outbound HMAC-SHA256 signed webhooks (`X-Mentrily-Signature`) with BullMQ retry dispatcher and delivery audit log | Partially implemented | **P1** | Essential for institutions connecting Mentrily events to external webhooks, Slack, or SIS systems. |
| **Admin API Key Management** | Scoped strictly to session JWT tokens | Scoped API key generator (`men_live_...`) with permission scopes, rate limits, and revocation in Admin UI | Missing | **P1** | Developers require headless programmatic access to automate course creation and student enrollment. |
| **Interactive API Documentation** | Static Markdown docs | Integrated Swagger / OpenAPI interactive developer portal inside Admin Dashboard | Missing | **P2** | Reduces integration friction and support burden for institutional developers. |

### 4. Partner Dashboard & Affiliate Portal

| Area | Current MVP State | Target Production State | Gap Category | Priority | Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Partner Portal Route** | No dedicated partner interface | Dedicated `/dashboard/partner` route for channel partners, academic resellers, and affiliates | Missing | **P1** | Core revenue-generation channel enabling third-party organizations to market Mentrily courses. |
| **Referral & Cohort Tracking** | None | Dynamic referral link tracking, cohort student enrollment monitoring, and commission payout metrics | Missing | **P2** | Partners need transparency into referred student completion rates and earned revenue share. |

### 5. Enhanced Super Admin Control Plane

| Area | Current MVP State | Target Production State | Gap Category | Priority | Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Platform Telemetry & Metrics** | Basic user count and organization list | Real-time system health dashboard (Judge0 cluster capacity, Redis queue depth, active WebSocket sockets) | Needs UX improvement | **P1** | Platform operators must identify compute bottlenecks before student exams are impacted. |
| **Tenant Impersonation / Support Mode** | None | Cryptographically audited tenant session assumption for instant customer support resolution | Missing | **P1** | Crucial for rapid triage of institutional customer issues without requesting passwords. |
| **Global Announcement Broadcast** | Scoped to individual teacher groups | Global broadcast banner system capable of reaching all tenants or targeting specific role segments | Partially implemented | **P2** | Informs institutions of maintenance windows and critical platform updates. |
