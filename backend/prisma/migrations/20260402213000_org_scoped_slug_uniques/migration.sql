-- Add orgId to CourseTest for org-scoped slug isolation
ALTER TABLE "CourseTest"
ADD COLUMN "orgId" TEXT;

-- Backfill CourseTest.orgId from owning course
UPDATE "CourseTest" ct
SET "orgId" = c."orgId"
FROM "Course" c
WHERE ct."courseId" = c."id";

-- Optional defensive dedupe (unlikely due to previous global slug uniqueness)
WITH dupes AS (
  SELECT "id", "slug", "orgId",
         ROW_NUMBER() OVER (PARTITION BY "slug", "orgId" ORDER BY "createdAt", "id") AS rn
  FROM "Exam"
)
UPDATE "Exam" e
SET "slug" = e."slug" || '-' || SUBSTRING(e."id" FROM 1 FOR 8)
FROM dupes d
WHERE e."id" = d."id" AND d.rn > 1;

WITH dupes AS (
  SELECT "id", "slug", "orgId",
         ROW_NUMBER() OVER (PARTITION BY "slug", "orgId" ORDER BY "createdAt", "id") AS rn
  FROM "Course"
)
UPDATE "Course" c
SET "slug" = c."slug" || '-' || SUBSTRING(c."id" FROM 1 FOR 8)
FROM dupes d
WHERE c."id" = d."id" AND d.rn > 1;

WITH dupes AS (
  SELECT "id", "slug", "orgId",
         ROW_NUMBER() OVER (PARTITION BY "slug", "orgId" ORDER BY "createdAt", "id") AS rn
  FROM "CourseTest"
)
UPDATE "CourseTest" ct
SET "slug" = ct."slug" || '-' || SUBSTRING(ct."id" FROM 1 FOR 8)
FROM dupes d
WHERE ct."id" = d."id" AND d.rn > 1;

-- Drop old global unique constraints
DROP INDEX IF EXISTS "Exam_slug_key";
DROP INDEX IF EXISTS "Course_slug_key";
DROP INDEX IF EXISTS "CourseTest_slug_key";

-- Add org-scoped composite unique constraints
CREATE UNIQUE INDEX "Exam_slug_orgId_key" ON "Exam"("slug", "orgId");
CREATE UNIQUE INDEX "Course_slug_orgId_key" ON "Course"("slug", "orgId");
CREATE UNIQUE INDEX "CourseTest_slug_orgId_key" ON "CourseTest"("slug", "orgId");

-- Add supporting index and FK for CourseTest.orgId
CREATE INDEX "CourseTest_orgId_idx" ON "CourseTest"("orgId");

ALTER TABLE "CourseTest"
ADD CONSTRAINT "CourseTest_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
