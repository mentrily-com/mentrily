## 2026-07-31 - [Prisma Aggregation Over JS Reduce]
**Learning:** [Fetching all records and computing sum in JS reduce causes N+1 like latency and high memory footprint, replacing it with db native aggregation pushes computation to database layer making it O(1) over the wire]
**Action:** [Use Prisma's native aggregation functions like `aggregate()` and `count()` over JS arrays operations for calculation queries on DB datasets]
