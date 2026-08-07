## 2026-08-07 - Prisma Aggregate vs In-Memory Reduce
**Learning:** Computing averages from Prisma records via `findMany` followed by `.reduce()` in Node.js creates severe memory bottlenecks by loading all rows into memory unnecessarily.
**Action:** Always prefer pushing computations to the database using Prisma's `.aggregate({ _avg, _sum, _count })` methods to minimize payload size and processing time, ensuring to safely handle potentially `null` return values.
