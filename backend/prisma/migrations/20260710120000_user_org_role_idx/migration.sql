-- Composite index for seat counting and counter recalculation, which filter
-- User rows by "WHERE orgId = $1 AND role IN (...)". The existing single-column
-- "User_orgId_idx" narrows to the org but then filters role in the heap, so a
-- large org (thousands of students, a handful of staff) scans every org user to
-- find the few ADMIN/TEACHER rows. This composite makes it a direct lookup.
--
-- NOTE: on a very large "User" table, apply this out-of-band with
--   CREATE INDEX CONCURRENTLY "User_orgId_role_idx" ON "User"("orgId", "role");
-- (run outside a transaction, e.g. via the Supabase SQL editor) to avoid the
-- brief write lock a plain CREATE INDEX takes while it builds.

CREATE INDEX "User_orgId_role_idx" ON "User"("orgId", "role");
