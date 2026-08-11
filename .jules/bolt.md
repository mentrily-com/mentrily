## 2026-08-11 - [Database-Level Aggregations]
**Learning:** Using Prisma's `.aggregate()` function is significantly faster and uses far less memory than fetching all rows with `.findMany()` and performing calculations in JavaScript using `.reduce()`. This is a codebase-specific performance pattern to look out for, especially in service layer methods calculating statistics.
**Action:** Always prefer database-level aggregations (`.aggregate()`, `.count()`) over in-memory computations for calculating statistics or summaries.
