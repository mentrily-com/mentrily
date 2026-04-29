ALTER TABLE "UnitSubmission"
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "timeTakenSec" INTEGER;

ALTER TABLE "ExamSession"
  ADD COLUMN IF NOT EXISTS "timeTakenSec" INTEGER;

UPDATE "UnitSubmission"
SET
  "startedAt" = COALESCE("startedAt", "createdAt"),
  "timeTakenSec" = COALESCE("timeTakenSec", GREATEST(EXTRACT(EPOCH FROM ("updatedAt" - COALESCE("startedAt", "createdAt")))::INT, 0))
WHERE "startedAt" IS NULL
   OR "timeTakenSec" IS NULL;

UPDATE "ExamSession"
SET "timeTakenSec" = GREATEST(EXTRACT(EPOCH FROM (COALESCE("endTime", "updatedAt") - "startTime"))::INT, 0)
WHERE "timeTakenSec" IS NULL
  AND "startTime" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "UnitSubmission_startedAt_idx"
  ON "UnitSubmission" ("startedAt");

CREATE INDEX IF NOT EXISTS "UnitSubmission_timeTakenSec_idx"
  ON "UnitSubmission" ("timeTakenSec");

CREATE INDEX IF NOT EXISTS "ExamSession_timeTakenSec_idx"
  ON "ExamSession" ("timeTakenSec");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorStudentBenchmarks";
CREATE MATERIALIZED VIEW public."CreatorStudentBenchmarks" AS
WITH exam_base AS (
  SELECT
    e."orgId" AS "orgId",
    es."userId" AS "userId",
    es."score" AS "score",
    COALESCE(es."timeTakenSec", EXTRACT(EPOCH FROM (COALESCE(es."endTime", es."updatedAt") - es."startTime"))::INT) AS "durationSec"
  FROM "ExamSession" es
  JOIN "Exam" e ON e."id" = es."examId"
  WHERE e."orgId" IS NOT NULL
    AND es."status" IN ('COMPLETED', 'TERMINATED')
),
unit_base AS (
  SELECT
    uo."orgId" AS "orgId",
    us."userId" AS "userId",
    us."score" AS "score",
    COALESCE(us."timeTakenSec", EXTRACT(EPOCH FROM (us."updatedAt" - COALESCE(us."startedAt", us."createdAt")))::INT) AS "durationSec"
  FROM "UnitSubmission" us
  JOIN "User" uo ON uo."id" = us."userId"
  WHERE uo."orgId" IS NOT NULL
)
SELECT
  base."orgId",
  base."userId",
  COALESCE(ROUND(AVG(base."score")::numeric, 2), 0)::DOUBLE PRECISION AS "averageScore",
  COALESCE(ROUND(AVG(GREATEST(base."durationSec", 0))::numeric, 2), 0)::DOUBLE PRECISION AS "averageTimeTakenSec",
  COALESCE(PERCENT_RANK() OVER (PARTITION BY base."orgId" ORDER BY AVG(base."score")), 0)::DOUBLE PRECISION AS "scorePercentile",
  COUNT(*)::INT AS "attemptCount"
FROM (
  SELECT * FROM exam_base
  UNION ALL
  SELECT * FROM unit_base
) base
GROUP BY base."orgId", base."userId"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorStudentBenchmarks_unique_idx"
  ON public."CreatorStudentBenchmarks" ("orgId", "userId");

DROP MATERIALIZED VIEW IF EXISTS public."LearnerStreakCalendar";
CREATE MATERIALIZED VIEW public."LearnerStreakCalendar" AS
WITH merged AS (
  SELECT
    us."userId" AS "userId",
    uo."orgId" AS "orgId",
    COALESCE(us."startedAt", us."createdAt")::date AS "activityDate",
    COALESCE(us."timeTakenSec", EXTRACT(EPOCH FROM (us."updatedAt" - COALESCE(us."startedAt", us."createdAt")))::INT) AS "timeTakenSec"
  FROM "UnitSubmission" us
  JOIN "User" uo ON uo."id" = us."userId"

  UNION ALL

  SELECT
    es."userId" AS "userId",
    e."orgId" AS "orgId",
    es."startTime"::date AS "activityDate",
    COALESCE(es."timeTakenSec", EXTRACT(EPOCH FROM (COALESCE(es."endTime", es."updatedAt") - es."startTime"))::INT) AS "timeTakenSec"
  FROM "ExamSession" es
  JOIN "Exam" e ON e."id" = es."examId"
)
SELECT
  "orgId",
  "userId",
  "activityDate",
  COUNT(*)::INT AS "activityCount",
  COALESCE(SUM(GREATEST("timeTakenSec", 0)), 0)::INT AS "timeSpentSec"
FROM merged
WHERE "orgId" IS NOT NULL
GROUP BY "orgId", "userId", "activityDate"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "LearnerStreakCalendar_unique_idx"
  ON public."LearnerStreakCalendar" ("orgId", "userId", "activityDate");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'graphql'
      AND p.proname = 'rebuild_schema'
  ) THEN
    PERFORM graphql.rebuild_schema();
  END IF;
END
$$;
