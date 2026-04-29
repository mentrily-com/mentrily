ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Exam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseModule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseTest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExamSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UnitSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Violation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEndpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bookmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnnouncementRead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BugReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_CourseStudents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_GroupStudents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_AnnouncementGroups" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_own" ON "Organization";
CREATE POLICY "org_read_own" ON "Organization"
  FOR SELECT
  TO authenticated
  USING (id = requesting_org_id());

DROP POLICY IF EXISTS "course_student_read" ON "Course";
CREATE POLICY "course_student_read" ON "Course"
  FOR SELECT
  TO authenticated
  USING (
    "orgId" = requesting_org_id()
    AND (
      requesting_user_role() IN ('TEACHER', 'ADMIN', 'SUPER_ADMIN')
      OR ("isVisible" = TRUE AND "status" = 'Published')
    )
  );

DROP POLICY IF EXISTS "module_read" ON "CourseModule";
CREATE POLICY "module_read" ON "CourseModule"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Course"
      WHERE "Course".id = "CourseModule"."courseId"
        AND "Course"."orgId" = requesting_org_id()
    )
  );

DROP POLICY IF EXISTS "unit_read" ON "Unit";
CREATE POLICY "unit_read" ON "Unit"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "CourseModule" cm
      JOIN "Course" c ON c.id = cm."courseId"
      WHERE cm.id = "Unit"."moduleId"
        AND c."orgId" = requesting_org_id()
    )
  );

DROP POLICY IF EXISTS "exam_read" ON "Exam";
CREATE POLICY "exam_read" ON "Exam"
  FOR SELECT
  TO authenticated
  USING (
    "orgId" = requesting_org_id()
    AND (
      requesting_user_role() IN ('TEACHER', 'ADMIN', 'SUPER_ADMIN')
      OR "isActive" = TRUE
    )
  );

DROP POLICY IF EXISTS "session_read_own" ON "ExamSession";
CREATE POLICY "session_read_own" ON "ExamSession"
  FOR SELECT
  TO authenticated
  USING ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "session_insert_own" ON "ExamSession";
CREATE POLICY "session_insert_own" ON "ExamSession"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "session_update_own" ON "ExamSession";
CREATE POLICY "session_update_own" ON "ExamSession"
  FOR UPDATE
  TO authenticated
  USING ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "submission_read_own" ON "UnitSubmission";
CREATE POLICY "submission_read_own" ON "UnitSubmission"
  FOR SELECT
  TO authenticated
  USING ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "submission_insert_own" ON "UnitSubmission";
CREATE POLICY "submission_insert_own" ON "UnitSubmission"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "bookmark_all_own" ON "Bookmark";
CREATE POLICY "bookmark_all_own" ON "Bookmark"
  FOR ALL
  TO authenticated
  USING ("userId" = requesting_user_id())
  WITH CHECK ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "progress_read_own" ON "CourseProgress";
CREATE POLICY "progress_read_own" ON "CourseProgress"
  FOR SELECT
  TO authenticated
  USING ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "announcement_read" ON "Announcement";
CREATE POLICY "announcement_read" ON "Announcement"
  FOR SELECT
  TO authenticated
  USING (
    "orgId" = requesting_org_id()
    AND (
      requesting_user_role() IN ('TEACHER', 'ADMIN', 'SUPER_ADMIN')
      OR EXISTS (
        SELECT 1 FROM "_AnnouncementGroups" ag
        JOIN "_GroupStudents" gs ON gs."A" = ag."B"
        WHERE ag."A" = "Announcement".id
          AND gs."B" = requesting_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "read_receipt_all_own" ON "AnnouncementRead";
CREATE POLICY "read_receipt_all_own" ON "AnnouncementRead"
  FOR ALL
  TO authenticated
  USING ("userId" = requesting_user_id())
  WITH CHECK ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "feedback_own" ON "Feedback";
CREATE POLICY "feedback_own" ON "Feedback"
  FOR ALL
  TO authenticated
  USING ("userId" = requesting_user_id())
  WITH CHECK ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "attempt_read_own" ON "QuestionAttempt";
CREATE POLICY "attempt_read_own" ON "QuestionAttempt"
  FOR SELECT
  TO authenticated
  USING ("userId" = requesting_user_id());

DROP POLICY IF EXISTS "cert_read_own" ON "Certificate";
CREATE POLICY "cert_read_own" ON "Certificate"
  FOR SELECT
  TO authenticated
  USING ("userId" = requesting_user_id());

REVOKE SELECT ON TABLE "User" FROM anon, authenticated;
REVOKE SELECT ON TABLE "AuditLog" FROM anon, authenticated;
REVOKE SELECT ON TABLE "AiUsage" FROM anon, authenticated;
REVOKE SELECT ON TABLE "SubscriptionEvent" FROM anon, authenticated;
REVOKE SELECT ON TABLE "UsageLedger" FROM anon, authenticated;
REVOKE SELECT ON TABLE "WebhookEndpoint" FROM anon, authenticated;
REVOKE SELECT ON TABLE "PendingInvite" FROM anon, authenticated;
REVOKE SELECT ON TABLE "BugReport" FROM anon, authenticated;
REVOKE SELECT ON TABLE "Violation" FROM anon, authenticated;
REVOKE SELECT ON TABLE "StudentGroup" FROM anon, authenticated;
REVOKE SELECT ON TABLE "CourseTest" FROM anon, authenticated;