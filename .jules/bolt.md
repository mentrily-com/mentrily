## 2024-08-12 - Replacing N+1 queries in Sync Loops
**Learning:** When syncing data across many relations (like recalculating progress for all students in a course), loops that trigger DB queries or cache invalidations per student create serious N+1 bottlenecks (e.g., hundreds of sequential network calls).
**Action:** Use a batch-fetch strategy (e.g. `findMany` with `in:`) to pull all needed relations at once, map them by ID in memory, and use `$transaction` and Redis pipelines to batch the writes and invalidations. This reduces execution time and network roundtrips drastically.
