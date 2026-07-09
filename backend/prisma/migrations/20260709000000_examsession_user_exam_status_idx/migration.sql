-- Hot-path index for start/resume session lookups and attempt counting:
-- WHERE "userId" = ? AND "examId" = ? AND "status" = ?
CREATE INDEX IF NOT EXISTS "ExamSession_userId_examId_status_idx"
  ON "ExamSession"("userId", "examId", "status");
