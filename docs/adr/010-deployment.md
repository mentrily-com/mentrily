# ADR 010: Hybrid Production Deployment Strategy

## Status
Accepted

## Context
The platform consists of a dynamic Next.js frontend, an event-driven NestJS backend with WebSockets and BullMQ, a persistent PostgreSQL database, and high-security sandbox runners. Deploying this entirely into serverless functions fails due to WebSocket connection lifetime constraints, background job workers, and large video upload timeouts.

## Decision
We deploy across specialized environments:
1. **Frontend**: Next.js App Router deployed on Vercel or Node.js container for optimal global edge CDN delivery and fast SSR.
2. **Backend & Workers**: Containerized NestJS application running on cloud VM / container orchestration (Oracle Cloud Always Free / AWS ECS / DigitalOcean Droplets) running Fastify HTTP, Socket.io WebSockets, and BullMQ worker processes.
3. **Database & Cache**: Supabase managed PostgreSQL (with PgBouncer) and managed Redis cluster.
4. **Sandboxed Compute**: Dedicated standalone Judge0 VM instance hardened with cgroups and isolated network namespaces.

## Consequences
- **Positive**: Each component operates in its ideal runtime environment (edge for static/SSR, persistent compute for WebSockets/queues, isolated VM for code sandbox).
- **Negative**: Requires multi-cloud/hybrid environment orchestration and CI/CD secret coordination.
