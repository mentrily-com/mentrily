# ADR 011: Bi-Directional Open-Source ERP Integration with ERPNext / Frappe

## Status
Accepted

## Context
Enterprise institutions, universities, and technical academies require unified enterprise resource planning (ERP) managing admissions, student billing, course credits, faculty workloads, and academic transcripts alongside the LMS. Running disparate silos leads to manual double-entry and sync errors.

## Decision
We integrate **ERPNext (Frappe Framework)** as the official open-source ERP partner system for Mentrily:
1. **Domain Model Mapping**:
   - `Mentrily User (STUDENT)` $\leftrightarrow$ `ERPNext Student`
   - `Mentrily User (TEACHER)` $\leftrightarrow$ `ERPNext Instructor`
   - `Mentrily Course` $\leftrightarrow$ `ERPNext Course & Program`
   - `Mentrily CourseProgress` $\leftrightarrow$ `ERPNext Program Enrollment & Course Activity`
   - `Mentrily Billing / Plan` $\leftrightarrow$ `ERPNext Sales Invoice & Fee Schedule`
2. **Synchronization Strategy**:
   - Outbound from Mentrily: Asynchronous BullMQ worker (`erp-sync-queue`) invokes ERPNext REST API endpoints authenticated via Frappe API Key/Secret.
   - Inbound from ERPNext: ERPNext DocType Webhooks push events (`on_update`, `on_submit`) to Mentrily's `POST /api/webhooks/erp` endpoint with signature validation.
3. **Seamless Direct Access**:
   - Super Admin and Organization Admins receive a direct single-click launcher to open the tenant's ERPNext Desk instance with pre-authenticated session tokens or OAuth2 SSO.

## Consequences
- **Positive**: Complete institutional grade ERP backing Mentrily without proprietary enterprise licensing costs.
- **Negative**: Requires maintaining network connectivity and credentials for external or containerized Frappe instances.
