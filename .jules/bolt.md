## 2026-08-04 - Database-level score aggregation
**Learning:** For Prisma ORM computations, relying on database-level aggregations like aggregate avoids memory pressure and overhead of retrieving and calculating large dataset items locally in reduce functions.
**Action:** When working on aggregates, always prefer standard DB-level querying via prisma instead of fetching all records and reducing locally.
