ALTER TABLE "ExamSession"
DROP CONSTRAINT IF EXISTS "ExamSession_userId_examId_key";

ALTER TABLE "ExamSession"
ADD COLUMN "attemptNumber" INT NOT NULL DEFAULT 1;

CREATE INDEX "ExamSession_userId_examId_attemptNumber_idx"
ON "ExamSession"("userId", "examId", "attemptNumber");
