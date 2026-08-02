## 2026-08-02 - Prisma _avg Returns Null When Empty
**Learning:** When using Prisma's `.aggregate()` function for database-level calculations, such as `_avg`, it returns `null` if there are no matching records (e.g., a student hasn't taken any exams). Attempting to use this value mathematically without checking can cause crashes or `NaN` outputs.
**Action:** Always handle potential `null` return values for aggregated fields when replacing in-memory map/reduce logic to safely account for cases where no records match the query.
