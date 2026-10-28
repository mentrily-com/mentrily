-- Brings the migration history back in line with schema.prisma. These
-- objects were added to the schema without migrations, so a fresh
-- `prisma migrate deploy` produced a database the code doesn't match.
-- Environments that already have some of them (e.g. via `db push`) must be
-- able to run this too, so every statement is guarded / IF NOT EXISTS.
--
-- Deliberately NOT included from `prisma migrate diff`:
--   DROP CONSTRAINT "Course_linkedExamId_fkey" -- deleteExam relies on its
--   ON DELETE SET NULL to clear Course.linkedExamId.

-- BugReportStatus is @@map("bug_report_status"). Rename instead of the
-- generated drop + re-add of BugReport.status, which would wipe every status.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BugReportStatus')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_report_status') THEN
    ALTER TYPE "BugReportStatus" RENAME TO "bug_report_status";
  ELSIF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bug_report_status') THEN
    CREATE TYPE "bug_report_status" AS ENUM ('OPEN', 'FIXED');
  END IF;
END $$;

-- Multiple attempts per exam: 20260421121000_examsession_attempts tried
-- DROP CONSTRAINT, but init created this as an index, so it survived and a
-- second attempt violated it on freshly migrated databases.
DROP INDEX IF EXISTS "ExamSession_userId_examId_key";

ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "timeTakenSec" INTEGER;
ALTER TABLE "UnitSubmission" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "UnitSubmission" ADD COLUMN IF NOT EXISTS "timeTakenSec" INTEGER;

CREATE INDEX IF NOT EXISTS "BugReport_status_idx" ON "BugReport"("status");
