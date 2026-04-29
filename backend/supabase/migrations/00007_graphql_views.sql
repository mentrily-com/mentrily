CREATE OR REPLACE VIEW public."CreatorCourseList" AS
SELECT
  c."id",
  c."title",
  c."slug",
  c."status",
  c."isVisible",
  c."createdAt",
  c."orgId",
  c."creatorId",
  COALESCE(COUNT(DISTINCT cs."B"), 0)::INT AS "studentCount",
  COALESCE(COUNT(DISTINCT cm."id"), 0)::INT AS "moduleCount"
FROM "Course" c
LEFT JOIN "_CourseStudents" cs ON cs."A" = c."id"
LEFT JOIN "CourseModule" cm ON cm."courseId" = c."id"
GROUP BY c."id";

CREATE OR REPLACE VIEW public."CreatorExamList" AS
SELECT
  e."id",
  e."slug",
  e."title",
  e."duration",
  e."isActive",
  e."resultsPublished",
  e."startTime",
  e."endTime",
  e."orgId",
  e."creatorId",
  e."createdAt",
  COALESCE(COUNT(es."id"), 0)::INT AS "submissionCount"
FROM "Exam" e
LEFT JOIN "ExamSession" es ON es."examId" = e."id"
GROUP BY e."id";

CREATE OR REPLACE VIEW public."CreatorUserList" AS
SELECT
  u."id",
  u."name",
  u."email",
  u."role",
  u."department",
  u."isActive",
  u."orgId",
  u."createdAt"
FROM "User" u;

CREATE OR REPLACE VIEW public."LearnerEnrolledCourse" AS
SELECT
  c."id",
  c."title",
  c."slug",
  c."status",
  c."isVisible",
  c."orgId",
  cs."B" AS "userId",
  cp."percent" AS "progressPercent",
  cp."status" AS "progressStatus",
  cp."completedCount",
  cp."totalUnits",
  c."createdAt"
FROM "Course" c
JOIN "_CourseStudents" cs ON cs."A" = c."id"
LEFT JOIN "CourseProgress" cp
  ON cp."courseId" = c."id"
 AND cp."userId" = cs."B";

CREATE OR REPLACE VIEW public."LearnerExamResult" AS
SELECT
  es."id" AS "sessionId",
  es."userId",
  es."examId",
  es."status",
  es."score",
  es."startTime",
  es."endTime",
  es."createdAt" AS "submittedAt",
  e."title" AS "examTitle",
  e."slug" AS "examSlug",
  e."orgId",
  e."duration",
  e."resultsPublished"
FROM "ExamSession" es
JOIN "Exam" e ON e."id" = es."examId";

CREATE OR REPLACE VIEW public."ExamMonitorView" AS
SELECT
  e."id" AS "examId",
  e."slug",
  e."title",
  e."orgId",
  e."creatorId",
  e."isActive",
  e."startTime",
  e."endTime",
  es."id" AS "sessionId",
  es."userId",
  es."status" AS "sessionStatus",
  es."score",
  es."startTime" AS "sessionStartTime",
  es."endTime" AS "sessionEndTime",
  COALESCE(COUNT(v."id"), 0)::INT AS "violationCount"
FROM "Exam" e
LEFT JOIN "ExamSession" es ON es."examId" = e."id"
LEFT JOIN "Violation" v ON v."sessionId" = es."id"
GROUP BY e."id", es."id";

GRANT SELECT ON TABLE
  public."CreatorCourseList",
  public."CreatorExamList",
  public."CreatorUserList",
  public."LearnerEnrolledCourse",
  public."LearnerExamResult",
  public."ExamMonitorView"
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