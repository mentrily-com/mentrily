ALTER TABLE "Organization"
  ADD COLUMN "provisionedFromUserId" TEXT;

CREATE TABLE "CourseAssignment" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "teacherId" TEXT,
  "assignedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CourseAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseAssignment_courseId_teacherId_key"
  ON "CourseAssignment"("courseId", "teacherId");

CREATE INDEX "CourseAssignment_teacherId_idx"
  ON "CourseAssignment"("teacherId");

CREATE INDEX "CourseAssignment_courseId_idx"
  ON "CourseAssignment"("courseId");

ALTER TABLE "CourseAssignment"
  ADD CONSTRAINT "CourseAssignment_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseAssignment"
  ADD CONSTRAINT "CourseAssignment_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseAssignment"
  ADD CONSTRAINT "CourseAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
