# ADR 003: Multi-Tenancy Scoping and Workspace Switching

## Status
Accepted

## Context
Educational institutions and enterprises require complete data isolation. However, instructors and students frequently participate in multiple organizations (e.g., a teacher in University A who is also an invited instructor in College B). A naive single-organization foreign key on `User` breaks this model.

## Decision
We adopt a hybrid multi-tenancy model:
1. `User.orgId` represents the user's permanent "home" organization.
2. `OrgMembership` records explicit memberships in additional organizations, with separate roles per org (e.g. Student in Org 1, Teacher in Org 2).
3. The active workspace is determined by the `X-Active-Org-Id` HTTP header, defaulting to `User.lastActiveOrgId` and then `User.orgId`.
4. All organization-scoped data (`Course`, `Exam`, `StudentGroup`, `Announcement`, `Certificate`) enforces foreign key relationships to `Organization(id)` and composite uniqueness on `(slug, orgId)`.

## Consequences
- **Positive**: Complete data isolation between institutions with flexible multi-institution participation.
- **Negative**: Queries must consistently resolve the active workspace role rather than relying solely on `User.role`.
