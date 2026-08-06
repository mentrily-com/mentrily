## 2025-08-06 - Replacing in-memory reduces with Prisma aggregate
**Learning:** In `student.service.ts`, `findMany` was being used to fetch all `examSession` objects (with score field) simply to do a `.reduce` calculation for the average in Node.js memory. This pulls potentially unbounded number of records into memory.
**Action:** Replace `findMany` with Prisma's `.aggregate()` using `_avg: { score: true }` to let the database do the calculation, saving network transfer and memory overhead in the application server. Always handle the potential `null` return on aggregation fields carefully.
