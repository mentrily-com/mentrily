## 2026-07-29 - Optimize Average Calculation
**Learning:** In Prisma, calculating aggregates like average or sum in the application memory using `reduce` can be significantly less efficient and memory-intensive compared to using native database aggregate functions.
**Action:** Always prefer using Prisma's `aggregate` operations (e.g., `_avg`, `_sum`, `_count`) over fetching large datasets with `findMany` and processing them in JavaScript.
