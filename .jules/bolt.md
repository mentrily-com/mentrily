## 2026-07-24 - Prisma Aggregations for Performance
**Learning:** Using `prisma.model.findMany` to fetch entire rows just to compute an average score with JavaScript `.reduce()` in Node.js creates large memory overhead and performance bottlenecks.
**Action:** Always prefer database-level aggregations (e.g., `_avg`, `_sum`, `_count`) using `prisma.model.aggregate` over pulling unneeded data into the Node.js process and doing it in memory.
