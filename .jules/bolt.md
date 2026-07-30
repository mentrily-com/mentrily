## 2026-07-30 - Database-Level Aggregation for Analytics
**Learning:** Application-level array methods (like `.reduce`) used after fetching all rows (`.findMany`) for calculations (like averages or sums) create memory and data transfer bottlenecks, especially for analytics endpoints like `getStats` that scale with user activity over time.
**Action:** Always prefer database-level aggregations (`.aggregate`) with proper `null` handling instead of loading data into memory when implementing statistical or analytical endpoints in Prisma.
