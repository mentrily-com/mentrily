## 2023-10-27 - [Optimize Database Aggregation]
**Learning:** For Prisma ORM computations, fetching all rows into Node.js memory just to calculate averages or sums using JavaScript array methods (like `.reduce()`) is inefficient and uses unnecessary memory, especially on large datasets.
**Action:** Always prefer database-level aggregations (e.g., `.aggregate({ _avg })`, `.count()`) over fetching complete rows and processing them in memory.
