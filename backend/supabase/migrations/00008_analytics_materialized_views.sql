CREATE EXTENSION IF NOT EXISTS pg_cron;

DROP MATERIALIZED VIEW IF EXISTS public."CreatorAnalyticsOverview";
CREATE MATERIALIZED VIEW public."CreatorAnalyticsOverview" AS
SELECT
  o."id" AS "orgId",
  COALESCE(COUNT(es."id") FILTER (WHERE es."status" = 'COMPLETED'), 0)::INT AS "totalExamAttempts",
  COALESCE(ROUND(AVG(es."score") FILTER (WHERE es."status" = 'COMPLETED')::numeric, 2), 0)::DOUBLE PRECISION AS "averageExamScore",
  COALESCE(COUNT(DISTINCT es."userId") FILTER (WHERE es."startTime" >= NOW() - INTERVAL '1 day'), 0)::INT AS "activeLearnersDau",
  COALESCE(COUNT(DISTINCT es."userId") FILTER (WHERE es."startTime" >= NOW() - INTERVAL '7 day'), 0)::INT AS "activeLearnersWau",
  COALESCE(COUNT(DISTINCT es."userId") FILTER (WHERE es."startTime" >= NOW() - INTERVAL '30 day'), 0)::INT AS "activeLearnersMau",
  COALESCE(COUNT(us."id"), 0)::INT AS "totalUnitAttempts",
  COALESCE(COUNT(us."id") FILTER (WHERE u."type" = 'Coding'), 0)::INT AS "totalCodeExecutions",
  NOW() AS "refreshedAt"
FROM "Organization" o
LEFT JOIN "Exam" e ON e."orgId" = o."id"
LEFT JOIN "ExamSession" es ON es."examId" = e."id"
LEFT JOIN "User" learner ON learner."orgId" = o."id"
LEFT JOIN "UnitSubmission" us ON us."userId" = learner."id"
LEFT JOIN "Unit" u ON u."id" = us."unitId"
GROUP BY o."id"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorAnalyticsOverview_orgId_idx"
  ON public."CreatorAnalyticsOverview" ("orgId");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorActivityHeatmap";
CREATE MATERIALIZED VIEW public."CreatorActivityHeatmap" AS
WITH activity AS (
  SELECT
    e."orgId" AS "orgId",
    es."startTime" AS "activityAt"
  FROM "ExamSession" es
  JOIN "Exam" e ON e."id" = es."examId"

  UNION ALL

  SELECT
    uo."orgId" AS "orgId",
    us."createdAt" AS "activityAt"
  FROM "UnitSubmission" us
  JOIN "User" uo ON uo."id" = us."userId"
)
SELECT
  "orgId",
  EXTRACT(DOW FROM "activityAt")::INT AS "dayOfWeek",
  EXTRACT(HOUR FROM "activityAt")::INT AS "hourOfDay",
  COUNT(*)::INT AS "activityCount",
  NOW() AS "refreshedAt"
FROM activity
WHERE "orgId" IS NOT NULL
  AND "activityAt" >= NOW() - INTERVAL '90 day'
GROUP BY "orgId", EXTRACT(DOW FROM "activityAt"), EXTRACT(HOUR FROM "activityAt")
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorActivityHeatmap_unique_idx"
  ON public."CreatorActivityHeatmap" ("orgId", "dayOfWeek", "hourOfDay");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorRetentionCohorts";
CREATE MATERIALIZED VIEW public."CreatorRetentionCohorts" AS
WITH activity AS (
  SELECT e."orgId" AS "orgId", es."userId" AS "userId", DATE_TRUNC('week', es."startTime")::date AS "activityWeek"
  FROM "ExamSession" es
  JOIN "Exam" e ON e."id" = es."examId"
  WHERE e."orgId" IS NOT NULL

  UNION

  SELECT uo."orgId" AS "orgId", us."userId" AS "userId", DATE_TRUNC('week', us."createdAt")::date AS "activityWeek"
  FROM "UnitSubmission" us
  JOIN "User" uo ON uo."id" = us."userId"
  WHERE uo."orgId" IS NOT NULL
),
cohorts AS (
  SELECT "orgId", "userId", MIN("activityWeek") AS "cohortWeek"
  FROM activity
  GROUP BY "orgId", "userId"
),
weekly AS (
  SELECT DISTINCT a."orgId", a."userId", c."cohortWeek", a."activityWeek"
  FROM activity a
  JOIN cohorts c
    ON c."orgId" = a."orgId"
   AND c."userId" = a."userId"
)
SELECT
  w."orgId",
  w."cohortWeek",
  GREATEST(0, ((w."activityWeek" - w."cohortWeek") / 7))::INT AS "weekNumber",
  COUNT(DISTINCT w."userId")::INT AS "retainedUsers",
  cohort_size."cohortSize",
  CASE
    WHEN cohort_size."cohortSize" > 0
      THEN ROUND((COUNT(DISTINCT w."userId")::numeric / cohort_size."cohortSize"::numeric) * 100, 2)
    ELSE 0
  END::DOUBLE PRECISION AS "retentionRate"
FROM weekly w
JOIN (
  SELECT "orgId", "cohortWeek", COUNT(DISTINCT "userId")::INT AS "cohortSize"
  FROM cohorts
  GROUP BY "orgId", "cohortWeek"
) cohort_size
  ON cohort_size."orgId" = w."orgId"
 AND cohort_size."cohortWeek" = w."cohortWeek"
GROUP BY w."orgId", w."cohortWeek", "weekNumber", cohort_size."cohortSize"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorRetentionCohorts_unique_idx"
  ON public."CreatorRetentionCohorts" ("orgId", "cohortWeek", "weekNumber");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorTeacherPerformance";
CREATE MATERIALIZED VIEW public."CreatorTeacherPerformance" AS
SELECT
  o."id" AS "orgId",
  t."id" AS "teacherId",
  COALESCE(t."name", t."email") AS "teacherName",
  COALESCE(COUNT(DISTINCT c."id"), 0)::INT AS "courseCount",
  COALESCE(COUNT(DISTINCT e."id"), 0)::INT AS "examCount",
  COALESCE(COUNT(DISTINCT cs."B"), 0)::INT AS "studentCount",
  COALESCE(ROUND(AVG(es."score") FILTER (WHERE es."status" = 'COMPLETED')::numeric, 2), 0)::DOUBLE PRECISION AS "averageExamScore"
FROM "Organization" o
JOIN "User" t ON t."orgId" = o."id" AND t."role" = 'TEACHER'
LEFT JOIN "Course" c ON c."orgId" = o."id" AND c."creatorId" = t."id"
LEFT JOIN "_CourseStudents" cs ON cs."A" = c."id"
LEFT JOIN "Exam" e ON e."orgId" = o."id" AND e."creatorId" = t."id"
LEFT JOIN "ExamSession" es ON es."examId" = e."id"
GROUP BY o."id", t."id", t."name", t."email"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorTeacherPerformance_unique_idx"
  ON public."CreatorTeacherPerformance" ("orgId", "teacherId");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorCodeExecutionDaily";
CREATE MATERIALIZED VIEW public."CreatorCodeExecutionDaily" AS
SELECT
  uo."orgId" AS "orgId",
  DATE_TRUNC('day', us."createdAt")::date AS "day",
  COUNT(*)::INT AS "executionCount",
  COUNT(*) FILTER (WHERE us."status" = 'COMPLETED')::INT AS "successCount",
  COALESCE(ROUND(AVG(us."score")::numeric, 2), 0)::DOUBLE PRECISION AS "averageScore"
FROM "UnitSubmission" us
JOIN "User" uo ON uo."id" = us."userId"
JOIN "Unit" u ON u."id" = us."unitId"
WHERE u."type" = 'Coding'
  AND uo."orgId" IS NOT NULL
GROUP BY uo."orgId", DATE_TRUNC('day', us."createdAt")::date
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorCodeExecutionDaily_unique_idx"
  ON public."CreatorCodeExecutionDaily" ("orgId", "day");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorCourseAnalytics";
CREATE MATERIALIZED VIEW public."CreatorCourseAnalytics" AS
WITH module_counts AS (
  SELECT
    cm."courseId",
    COUNT(*)::INT AS "moduleCount"
  FROM "CourseModule" cm
  GROUP BY cm."courseId"
),
student_counts AS (
  SELECT
    cs."A" AS "courseId",
    COUNT(*)::INT AS "enrolledStudents"
  FROM "_CourseStudents" cs
  GROUP BY cs."A"
),
progress_agg AS (
  SELECT
    cp."courseId",
    AVG(cp."percent")::DOUBLE PRECISION AS "avgCompletionRate",
    AVG(cp."completedCount")::DOUBLE PRECISION AS "avgCompletedUnits"
  FROM "CourseProgress" cp
  GROUP BY cp."courseId"
),
unit_time_agg AS (
  SELECT
    cm."courseId",
    AVG(GREATEST(EXTRACT(EPOCH FROM (us."updatedAt" - us."createdAt")), 0))::DOUBLE PRECISION AS "avgUnitTimeSec"
  FROM "UnitSubmission" us
  JOIN "Unit" u ON u."id" = us."unitId"
  JOIN "CourseModule" cm ON cm."id" = u."moduleId"
  JOIN "Course" c ON c."id" = cm."courseId"
  JOIN "User" learner ON learner."id" = us."userId"
  WHERE c."orgId" IS NOT NULL
    AND learner."orgId" = c."orgId"
  GROUP BY cm."courseId"
)
SELECT
  c."orgId" AS "orgId",
  c."id" AS "courseId",
  c."title" AS "title",
  COALESCE(ROUND(pa."avgCompletionRate"::numeric, 2), 0)::DOUBLE PRECISION AS "completionRate",
  COALESCE(
    LEAST(
      GREATEST(
        FLOOR(
          (
            COALESCE(pa."avgCompletedUnits", 0)
            /
            NULLIF(COALESCE(mc."moduleCount", 0), 0)
          ) * COALESCE(mc."moduleCount", 0)
        )::INT + 1,
        1
      ),
      COALESCE(NULLIF(mc."moduleCount", 0), 1)
    ),
    1
  )::INT AS "dropoffModule",
  COALESCE(ROUND(uta."avgUnitTimeSec"::numeric, 2), 0)::DOUBLE PRECISION AS "averageTimePerUnitSec",
  COALESCE(mc."moduleCount", 0)::INT AS "moduleCount",
  COALESCE(sc."enrolledStudents", 0)::INT AS "enrolledStudents",
  NOW() AS "refreshedAt"
FROM "Course" c
LEFT JOIN module_counts mc ON mc."courseId" = c."id"
LEFT JOIN student_counts sc ON sc."courseId" = c."id"
LEFT JOIN progress_agg pa ON pa."courseId" = c."id"
LEFT JOIN unit_time_agg uta ON uta."courseId" = c."id"
WHERE c."orgId" IS NOT NULL
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorCourseAnalytics_unique_idx"
  ON public."CreatorCourseAnalytics" ("orgId", "courseId");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorExamAnalytics";
CREATE MATERIALIZED VIEW public."CreatorExamAnalytics" AS
SELECT
  e."orgId" AS "orgId",
  e."id" AS "examId",
  e."title" AS "title",
  COALESCE(COUNT(es."id"), 0)::INT AS "submissionCount",
  COALESCE(
    COUNT(es."id") FILTER (
      WHERE es."status" = 'COMPLETED' AND COALESCE(es."score", 0) >= 50
    ),
    0
  )::INT AS "passCount",
  COALESCE(
    COUNT(es."id") FILTER (
      WHERE es."status" = 'COMPLETED' AND COALESCE(es."score", 0) < 50
    ),
    0
  )::INT AS "failCount",
  COALESCE(
    ROUND(
      (
        COUNT(es."id") FILTER (
          WHERE es."status" = 'COMPLETED' AND COALESCE(es."score", 0) >= 50
        )::numeric
        / NULLIF(COUNT(es."id") FILTER (WHERE es."status" = 'COMPLETED'), 0)
      ) * 100,
      2
    ),
    0
  )::DOUBLE PRECISION AS "passRate",
  COALESCE(
    ROUND(
      (
        COUNT(es."id") FILTER (
          WHERE es."status" = 'COMPLETED' AND COALESCE(es."score", 0) < 50
        )::numeric
        / NULLIF(COUNT(es."id") FILTER (WHERE es."status" = 'COMPLETED'), 0)
      ) * 100,
      2
    ),
    0
  )::DOUBLE PRECISION AS "failRate",
  COALESCE(
    ROUND(
      AVG(es."score") FILTER (WHERE es."status" = 'COMPLETED')::numeric,
      2
    ),
    0
  )::DOUBLE PRECISION AS "averageScore",
  COALESCE(
    ROUND(
      AVG(
        GREATEST(
          EXTRACT(EPOCH FROM (COALESCE(es."endTime", es."updatedAt") - es."startTime")),
          0
        )
      ) FILTER (WHERE es."status" IN ('COMPLETED', 'TERMINATED'))::numeric,
      2
    ),
    0
  )::DOUBLE PRECISION AS "averageTimeTakenSec",
  e."isActive" AS "isActive",
  e."startTime" AS "startTime",
  e."endTime" AS "endTime",
  e."createdAt" AS "createdAt",
  NOW() AS "refreshedAt"
FROM "Exam" e
LEFT JOIN "ExamSession" es ON es."examId" = e."id"
WHERE e."orgId" IS NOT NULL
GROUP BY e."orgId", e."id", e."title", e."isActive", e."startTime", e."endTime", e."createdAt"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorExamAnalytics_unique_idx"
  ON public."CreatorExamAnalytics" ("orgId", "examId");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorExamScoreDistribution";
CREATE MATERIALIZED VIEW public."CreatorExamScoreDistribution" AS
WITH base AS (
  SELECT
    e."orgId" AS "orgId",
    e."id" AS "examId",
    e."title" AS "examTitle",
    LEAST(100, GREATEST(0, FLOOR(COALESCE(es."score", 0) / 10) * 10))::INT AS "scoreBucket"
  FROM "ExamSession" es
  JOIN "Exam" e ON e."id" = es."examId"
  WHERE e."orgId" IS NOT NULL
    AND es."status" = 'COMPLETED'
    AND es."score" IS NOT NULL
)
SELECT
  b."orgId",
  b."examId",
  b."examTitle",
  b."scoreBucket",
  CONCAT(b."scoreBucket"::TEXT, '-', LEAST(b."scoreBucket" + 9, 100)::TEXT) AS "bucketLabel",
  COUNT(*)::INT AS "submissionCount",
  NOW() AS "refreshedAt"
FROM base b
GROUP BY b."orgId", b."examId", b."examTitle", b."scoreBucket"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorExamScoreDistribution_unique_idx"
  ON public."CreatorExamScoreDistribution" ("orgId", "examId", "scoreBucket");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorExamQuestionDifficulty";
CREATE MATERIALIZED VIEW public."CreatorExamQuestionDifficulty" AS
SELECT
  e."orgId" AS "orgId",
  e."id" AS "examId",
  qa."itemId" AS "itemId",
  COUNT(*)::INT AS "attemptCount",
  COUNT(*) FILTER (WHERE qa."isCorrect" = true)::INT AS "correctCount",
  COALESCE(
    ROUND(
      (
        COUNT(*) FILTER (WHERE qa."isCorrect" = true)::numeric
        / NULLIF(COUNT(*), 0)
      ) * 100,
      2
    ),
    0
  )::DOUBLE PRECISION AS "correctRate",
  CASE
    WHEN COALESCE(
      ROUND(
        (
          COUNT(*) FILTER (WHERE qa."isCorrect" = true)::numeric
          / NULLIF(COUNT(*), 0)
        ) * 100,
        2
      ),
      0
    ) >= 80 THEN 'Easy'
    WHEN COALESCE(
      ROUND(
        (
          COUNT(*) FILTER (WHERE qa."isCorrect" = true)::numeric
          / NULLIF(COUNT(*), 0)
        ) * 100,
        2
      ),
      0
    ) >= 50 THEN 'Medium'
    ELSE 'Hard'
  END AS "difficulty",
  NOW() AS "refreshedAt"
FROM "QuestionAttempt" qa
JOIN "ExamSession" es ON es."id" = qa."sessionId"
JOIN "Exam" e ON e."id" = es."examId"
WHERE qa."type" = 'EXAM'
  AND e."orgId" IS NOT NULL
GROUP BY e."orgId", e."id", qa."itemId"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorExamQuestionDifficulty_unique_idx"
  ON public."CreatorExamQuestionDifficulty" ("orgId", "examId", "itemId");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorActivityTrends";
CREATE MATERIALIZED VIEW public."CreatorActivityTrends" AS
WITH exam_daily AS (
  SELECT
    e."orgId" AS "orgId",
    DATE_TRUNC('day', es."startTime")::date AS "periodDate",
    COUNT(*)::INT AS "examSubmissions"
  FROM "ExamSession" es
  JOIN "Exam" e ON e."id" = es."examId"
  WHERE e."orgId" IS NOT NULL
  GROUP BY e."orgId", DATE_TRUNC('day', es."startTime")::date
),
course_daily AS (
  SELECT
    c."orgId" AS "orgId",
    DATE_TRUNC('day', cp."updatedAt")::date AS "periodDate",
    COUNT(*) FILTER (WHERE cp."status" = 'Completed')::INT AS "courseCompletions"
  FROM "CourseProgress" cp
  JOIN "Course" c ON c."id" = cp."courseId"
  WHERE c."orgId" IS NOT NULL
  GROUP BY c."orgId", DATE_TRUNC('day', cp."updatedAt")::date
),
active_daily AS (
  SELECT
    merged."orgId",
    merged."periodDate",
    COUNT(DISTINCT merged."userId")::INT AS "activeUsers"
  FROM (
    SELECT
      e."orgId" AS "orgId",
      DATE_TRUNC('day', es."startTime")::date AS "periodDate",
      es."userId" AS "userId"
    FROM "ExamSession" es
    JOIN "Exam" e ON e."id" = es."examId"
    WHERE e."orgId" IS NOT NULL

    UNION ALL

    SELECT
      uo."orgId" AS "orgId",
      DATE_TRUNC('day', us."createdAt")::date AS "periodDate",
      us."userId" AS "userId"
    FROM "UnitSubmission" us
    JOIN "User" uo ON uo."id" = us."userId"
    WHERE uo."orgId" IS NOT NULL
  ) merged
  GROUP BY merged."orgId", merged."periodDate"
)
SELECT
  org."id" AS "orgId",
  days."periodDate" AS "periodDate",
  COALESCE(ed."examSubmissions", 0)::INT AS "examSubmissions",
  COALESCE(cd."courseCompletions", 0)::INT AS "courseCompletions",
  COALESCE(ad."activeUsers", 0)::INT AS "activeUsers",
  NOW() AS "refreshedAt"
FROM "Organization" org
CROSS JOIN LATERAL (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '180 day')::date,
    CURRENT_DATE::date,
    INTERVAL '1 day'
  )::date AS "periodDate"
) days
LEFT JOIN exam_daily ed
  ON ed."orgId" = org."id"
 AND ed."periodDate" = days."periodDate"
LEFT JOIN course_daily cd
  ON cd."orgId" = org."id"
 AND cd."periodDate" = days."periodDate"
LEFT JOIN active_daily ad
  ON ad."orgId" = org."id"
 AND ad."periodDate" = days."periodDate"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorActivityTrends_unique_idx"
  ON public."CreatorActivityTrends" ("orgId", "periodDate");

DROP MATERIALIZED VIEW IF EXISTS public."CreatorStudentBenchmarks";
CREATE MATERIALIZED VIEW public."CreatorStudentBenchmarks" AS
WITH exam_base AS (
  SELECT
    e."orgId" AS "orgId",
    es."userId" AS "userId",
    es."score" AS "score",
    EXTRACT(EPOCH FROM (COALESCE(es."endTime", es."updatedAt") - es."startTime"))::INT AS "durationSec"
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
    EXTRACT(EPOCH FROM (us."updatedAt" - us."createdAt"))::INT AS "durationSec"
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
  COUNT(*)::INT AS "attemptCount",
  NOW() AS "refreshedAt"
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
    us."createdAt"::date AS "activityDate",
    EXTRACT(EPOCH FROM (us."updatedAt" - us."createdAt"))::INT AS "timeTakenSec"
  FROM "UnitSubmission" us
  JOIN "User" uo ON uo."id" = us."userId"

  UNION ALL

  SELECT
    es."userId" AS "userId",
    e."orgId" AS "orgId",
    es."startTime"::date AS "activityDate",
    EXTRACT(EPOCH FROM (COALESCE(es."endTime", es."updatedAt") - es."startTime"))::INT AS "timeTakenSec"
  FROM "ExamSession" es
  JOIN "Exam" e ON e."id" = es."examId"
)
SELECT
  "orgId",
  "userId",
  "activityDate",
  COUNT(*)::INT AS "activityCount",
  COALESCE(SUM(GREATEST("timeTakenSec", 0)), 0)::INT AS "timeSpentSec",
  NOW() AS "refreshedAt"
FROM merged
WHERE "orgId" IS NOT NULL
GROUP BY "orgId", "userId", "activityDate"
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "LearnerStreakCalendar_unique_idx"
  ON public."LearnerStreakCalendar" ("orgId", "userId", "activityDate");

CREATE OR REPLACE FUNCTION public.refresh_analytics_materialized_views()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorAnalyticsOverview";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorActivityHeatmap";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorRetentionCohorts";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorTeacherPerformance";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorCodeExecutionDaily";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorCourseAnalytics";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorExamAnalytics";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorExamScoreDistribution";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorExamQuestionDifficulty";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorActivityTrends";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."CreatorStudentBenchmarks";
  REFRESH MATERIALIZED VIEW CONCURRENTLY public."LearnerStreakCalendar";
END;
$$;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR existing_job_id IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'refresh_analytics_materialized_views'
    LOOP
      PERFORM cron.unschedule(existing_job_id);
    END LOOP;

    PERFORM cron.schedule(
      'refresh_analytics_materialized_views',
      '*/15 * * * *',
      'SELECT public.refresh_analytics_materialized_views();'
    );
  END IF;
END
$$;

GRANT SELECT ON TABLE
  public."CreatorAnalyticsOverview",
  public."CreatorActivityHeatmap",
  public."CreatorRetentionCohorts",
  public."CreatorTeacherPerformance",
  public."CreatorCodeExecutionDaily",
  public."CreatorCourseAnalytics",
  public."CreatorExamAnalytics",
  public."CreatorExamScoreDistribution",
  public."CreatorExamQuestionDifficulty",
  public."CreatorActivityTrends",
  public."CreatorStudentBenchmarks",
  public."LearnerStreakCalendar"
TO authenticated;

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
