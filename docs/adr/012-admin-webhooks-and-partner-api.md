# ADR 012: Admin Webhook Architecture and Partner Developer API

## Status
Accepted

## Context
Organizations and institutional partners need to integrate Mentrily into their existing SIS (Student Information Systems), CI/CD pipelines, and internal portals. They require programmatic REST APIs, API key management, and real-time webhook event subscriptions (e.g. `exam.completed`, `certificate.issued`, `student.enrolled`).

## Decision
We implement a dedicated Developer Platform subsystem for Organization Admins and Partners:
1. **Webhook Delivery Subsystem**:
   - `WebhookEndpoint` stores target URLs, subscribed event types, active status, and generated HMAC secrets.
   - Event emitter dispatches domain events to BullMQ `webhook-dispatch` queue.
   - Worker signs payload with `HMAC-SHA256` header (`X-Mentrily-Signature: t=timestamp,v1=signature`) and transmits to target with exponential backoff (up to 5 retries).
   - Delivery attempts, status codes, and latency are logged in `WebhookDeliveryLog` for admin auditing and test-pinging.
2. **Admin & Partner API Key Management**:
   - Admins generate scoped API keys (`men_live_...`) with fine-grained permissions (`courses:read`, `exams:write`, `students:read`).
   - Requests carrying `Authorization: Bearer men_live_...` authenticate via `ApiKeyAuthGuard` and enforce tenant rate limits.
3. **Dedicated Partner Portal**:
   - A distinct `/dashboard/partner` surface offering cohort tracking, referral links, revenue-share metrics, and co-branded onboarding widgets.

## Consequences
- **Positive**: Enables external enterprise automation, eliminates manual reporting, and creates automated B2B partner revenue streams.
- **Negative**: Requires robust outbound webhook worker capacity and defensive retry backoff to avoid hanging on slow client endpoints.
