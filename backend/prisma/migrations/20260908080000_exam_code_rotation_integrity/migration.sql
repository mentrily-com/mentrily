-- Rotation due-time was computed from `updatedAt`, which any unrelated
-- write to the Exam row bumps -- silently resetting the rotation clock.
-- codeRotatedAt is a dedicated timestamp set only by the rotation worker.
ALTER TABLE "Exam" ADD COLUMN "codeRotatedAt" TIMESTAMP(3);

-- testCode was only non-uniquely indexed, so two exams (across orgs, or a
-- rotated-away code re-colliding with another exam's current code) could
-- share the same code -- verifyExamTestCode/examLogin both look it up with
-- findFirst, so a collision could silently authenticate a student into the
-- wrong exam. No existing duplicates were found before adding this
-- constraint (verified via a live query against the production database).
DROP INDEX IF EXISTS "Exam_testCode_idx";
CREATE UNIQUE INDEX "Exam_testCode_key" ON "Exam"("testCode");
