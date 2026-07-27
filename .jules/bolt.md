## 2025-02-14 - Replace fetching rows and array reduce with Prisma aggregate
**Learning:** For Prisma ORM computations in the backend, prefer database-level aggregations (e.g., `.aggregate()`, `.count()`) over fetching all rows and applying in-memory JavaScript array methods (like `.reduce()`) to optimize performance and memory usage. Fetching potentially thousands of score rows just to average them uses significant memory and CPU.
**Action:** Replace `sessionsWithScore.reduce` with `prisma.examSession.aggregate({ _avg: { score: true } })`
