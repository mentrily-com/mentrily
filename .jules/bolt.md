## 2024-05-24 - Prisma Data Fetching Anti-Pattern
**Learning:** Found instances where large result sets were being fetched into memory via `findMany()` just to perform a mathematical aggregation (e.g., calculating average score via `reduce()`). This causes high application memory overhead and unneeded data transfer over the wire.
**Action:** Always delegate mathematical operations (average, sum, count) to the database layer using Prisma's `.aggregate()` or `.count()` rather than extracting records into Node.js space.
