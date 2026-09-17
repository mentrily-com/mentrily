-- Additional query-path indexes added to schema.prisma alongside the
-- multi-tenant org-scoped list/dashboard queries (Exam, ExamSession,
-- Course, SubscriptionEvent) and the AI Studio conversation views
-- (AiUsage, AiJob). Index-only: IF NOT EXISTS keeps it safe to re-run
-- where some already exist. Follows the same pattern as
-- 20260914090000_performance_indexes.

CREATE INDEX IF NOT EXISTS "Exam_orgId_isActive_idx" ON "Exam"("orgId", "isActive");
CREATE INDEX IF NOT EXISTS "Exam_orgId_isActive_startTime_idx" ON "Exam"("orgId", "isActive", "startTime");
CREATE INDEX IF NOT EXISTS "Exam_orgId_createdAt_idx" ON "Exam"("orgId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ExamSession_examId_endTime_idx" ON "ExamSession"("examId", "endTime" DESC);
CREATE INDEX IF NOT EXISTS "ExamSession_examId_score_idx" ON "ExamSession"("examId", "score");
CREATE INDEX IF NOT EXISTS "ExamSession_examId_status_idx" ON "ExamSession"("examId", "status");

CREATE INDEX IF NOT EXISTS "Course_isVisible_orgId_idx" ON "Course"("isVisible", "orgId");
CREATE INDEX IF NOT EXISTS "Course_orgId_createdAt_idx" ON "Course"("orgId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Course_orgId_status_idx" ON "Course"("orgId", "status");

CREATE INDEX IF NOT EXISTS "SubscriptionEvent_createdAt_idx" ON "SubscriptionEvent"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_eventType_createdAt_idx" ON "SubscriptionEvent"("eventType", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AiUsage_conversationId_idx" ON "AiUsage"("conversationId");

CREATE INDEX IF NOT EXISTS "AiJob_conversationId_idx" ON "AiJob"("conversationId");
CREATE INDEX IF NOT EXISTS "AiJob_orgId_status_createdAt_idx" ON "AiJob"("orgId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AiJob_userId_status_createdAt_idx" ON "AiJob"("userId", "status", "createdAt");
