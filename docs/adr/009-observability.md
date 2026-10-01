# ADR 009: Observability, Distributed Tracing and Audit Logging

## Status
Accepted

## Context
Operating high-stakes examinations across multiple institutions requires instantaneous visibility into server latency spikes, WebSocket dropouts, code-execution compiler queues, and malicious tampering attempts.

## Decision
We establish a multi-tier observability framework:
1. **APM & Distributed Tracing**: Datadog APM (`dd-trace`) is initialized at the absolute first line of `backend/src/main.ts` and `tracer.ts` to trace Fastify routes, Prisma database queries, Redis operations, and outbound HTTP calls.
2. **Audit Logging**: An immutable database ledger (`AuditLog`) records security-sensitive operations (exam deletion, role elevation, manual score overrides, organization settings changes) with timestamp, actor ID, and IP address.
3. **Structured Logging**: NestJS built-in logger enriched with request IDs and correlation tokens across async BullMQ jobs.

## Consequences
- **Positive**: Complete forensic accountability for exam disputes and immediate alert triage during live events.
- **Negative**: Adds Datadog agent infrastructure requirements in production.
