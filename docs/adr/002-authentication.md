# ADR 002: Dual Authentication Model with Clerk and Exam Lockdown

## Status
Accepted

## Context
The platform requires seamless user authentication for regular web app usage (courses, dashboards, creator tools) alongside strict anti-cheat and session-lockdown mechanisms for exam takers. Web users benefit from modern identity providers (social logins, passkeys, SSO), while proctored exams require explicit roll numbers, section validation, and fixed session integrity.

## Decision
We implement a dual authentication architecture:
1. **Platform Authentication**: Clerk handles user identity, OAuth providers, MFA, and JWT issuance. Backend verifies tokens via `ClerkAuthGuard` and extracts `clerkId`.
2. **Exam Authentication**: `/auth/exam-login` enforces secondary verification with candidate roll number, organization status, and bcrypt password hashing. Exam tokens are scoped specifically to the candidate's exam session and enforce single-active-session constraints.

## Consequences
- **Positive**: Best-of-both-worlds UX — friction-free login for regular study, ironclad lockdown for proctored tests.
- **Negative**: Two distinct auth flows must be maintained in the frontend and documented clearly for API consumers.
