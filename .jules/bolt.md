## 2025-02-20 - [Database Aggregation for Averages]
**Learning:** Calculating averages by fetching all rows in memory (`findMany` then `.reduce`) is a performance bottleneck for data that can grow linearly over time (like `examSession` scores). Prisma's `aggregate({ _avg: { field: true } })` is more efficient by delegating calculation to PostgreSQL.
**Action:** Use database aggregations (`count`, `aggregate`, `groupBy`) instead of in-memory JS array methods for statistical computations.
