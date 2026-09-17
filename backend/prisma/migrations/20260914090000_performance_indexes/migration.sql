-- Query-path indexes added to schema.prisma alongside the N+1 / list-query
-- performance work. Index-only: IF NOT EXISTS keeps it safe to re-run where
-- some already exist.

CREATE INDEX IF NOT EXISTS "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_timestamp_idx" ON "AuditLog"("action", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "Bookmark_unitId_idx" ON "Bookmark"("unitId");
CREATE INDEX IF NOT EXISTS "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BugReport_status_idx" ON "BugReport"("status");
CREATE INDEX IF NOT EXISTS "Certificate_orgId_issuedAt_idx" ON "Certificate"("orgId", "issuedAt" DESC);
CREATE INDEX IF NOT EXISTS "Certificate_resourceId_idx" ON "Certificate"("resourceId");
CREATE INDEX IF NOT EXISTS "Course_certificateTemplateId_idx" ON "Course"("certificateTemplateId");
CREATE INDEX IF NOT EXISTS "Course_creatorId_updatedAt_idx" ON "Course"("creatorId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Course_orgId_updatedAt_idx" ON "Course"("orgId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "CourseAssignment_assignedById_idx" ON "CourseAssignment"("assignedById");
CREATE INDEX IF NOT EXISTS "CourseProgress_courseId_status_idx" ON "CourseProgress"("courseId", "status");
CREATE INDEX IF NOT EXISTS "CourseProgress_courseId_percent_idx" ON "CourseProgress"("courseId", "percent");
CREATE INDEX IF NOT EXISTS "CourseTest_slug_idx" ON "CourseTest"("slug");
CREATE INDEX IF NOT EXISTS "CourseTest_courseId_startDate_idx" ON "CourseTest"("courseId", "startDate");
CREATE INDEX IF NOT EXISTS "Exam_orgId_updatedAt_idx" ON "Exam"("orgId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Exam_creatorId_updatedAt_idx" ON "Exam"("creatorId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Exam_creatorId_startTime_idx" ON "Exam"("creatorId", "startTime");
CREATE INDEX IF NOT EXISTS "Exam_isActive_testCodeType_idx" ON "Exam"("isActive", "testCodeType");
CREATE INDEX IF NOT EXISTS "Exam_isActive_testCodeType_rotationInterval_idx" ON "Exam"("isActive", "testCodeType", "rotationInterval");
CREATE INDEX IF NOT EXISTS "ExamSession_status_startTime_idx" ON "ExamSession"("status", "startTime");
CREATE INDEX IF NOT EXISTS "ExamSession_userId_createdAt_idx" ON "ExamSession"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Feedback_examId_timestamp_idx" ON "Feedback"("examId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "OrgMembership_orgId_role_status_idx" ON "OrgMembership"("orgId", "role", "status");
CREATE INDEX IF NOT EXISTS "PendingInvite_orgId_expiresAt_idx" ON "PendingInvite"("orgId", "expiresAt");
CREATE INDEX IF NOT EXISTS "PendingInvite_orgId_role_expiresAt_idx" ON "PendingInvite"("orgId", "role", "expiresAt");
CREATE INDEX IF NOT EXISTS "PendingInvite_email_expiresAt_idx" ON "PendingInvite"("email", "expiresAt");
CREATE INDEX IF NOT EXISTS "QuestionAttempt_sessionId_itemId_createdAt_idx" ON "QuestionAttempt"("sessionId", "itemId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "QuestionAttempt_userId_type_itemId_idx" ON "QuestionAttempt"("userId", "type", "itemId");
CREATE INDEX IF NOT EXISTS "Unit_moduleId_order_idx" ON "Unit"("moduleId", "order");
CREATE INDEX IF NOT EXISTS "UnitSubmission_userId_status_unitId_idx" ON "UnitSubmission"("userId", "status", "unitId");
CREATE INDEX IF NOT EXISTS "UnitSubmission_userId_createdAt_idx" ON "UnitSubmission"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "UsageLedger_orgId_eventType_createdAt_idx" ON "UsageLedger"("orgId", "eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "User_orgId_isActive_idx" ON "User"("orgId", "isActive");
CREATE INDEX IF NOT EXISTS "Violation_sessionId_timestamp_idx" ON "Violation"("sessionId", "timestamp" DESC);
