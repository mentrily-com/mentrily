## 2024-05-18 - [Prisma In-Memory Array reduce vs Database Aggregation]
**Learning:** Found a performance bottleneck where fetching all examSession rows to memory just to compute an average score using `.reduce()` in JS consumed unnecessary CPU and memory.
**Action:** Always prefer database-level aggregations (`.aggregate()`, `.count()`, etc.) over pulling full rows into memory for simple math calculations to minimize network latency and Node CPU usage.
