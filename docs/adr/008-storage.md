# ADR 008: Object Storage and Direct-to-Backend Video Uploads

## Status
Accepted

## Context
Course creators upload video lectures (up to 500MB), PDF resources, organization branding logos, and generated certificate files. Routing large file uploads through the Next.js API proxy triggers Vercel's 4.5MB request payload ceiling, causing dropped uploads.

## Decision
We establish a two-path storage architecture:
1. **Large Video Uploads**: Video files upload directly to the NestJS backend endpoint (`POST /api/courses/videos`) utilizing Fastify's high-memory stream buffer (`fastify-multipart`, 500MB file limit) with Bearer token authentication, bypassing Next.js edge limits entirely.
2. **Standard Assets & Avatars**: User profile photos, organization logos, and bug report attachments utilize presigned S3 URLs directly to DigitalOcean Spaces.
3. **Public Distribution**: Media assets and certificate PDFs are delivered via an AWS CloudFront CDN distribution in front of the private bucket with strict CORS and caching headers.

## Consequences
- **Positive**: Reliable video uploads up to 500MB without edge proxy timeouts or payload truncation.
- **Negative**: The backend server must allocate sufficient network bandwidth and memory buffers during concurrent video uploads.
