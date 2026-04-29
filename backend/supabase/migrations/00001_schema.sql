CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.role AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE public.bug_report_status AS ENUM ('OPEN', 'FIXED');
CREATE TYPE public.plan AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');
CREATE TYPE public.plan_status AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

CREATE TABLE "Organization" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "logo" TEXT,
  "domain" TEXT,
  "maxUsers" INTEGER NOT NULL DEFAULT 100,
  "maxCourses" INTEGER NOT NULL DEFAULT 5,
  "storageLimit" INTEGER NOT NULL DEFAULT 1024,
  "examsPerMonth" INTEGER NOT NULL DEFAULT 50,
  "plan" public.plan NOT NULL DEFAULT 'FREE',
  "stripeCustomerId" TEXT UNIQUE,
  "stripeSubscriptionId" TEXT,
  "stripePriceId" TEXT,
  "planExpiresAt" TIMESTAMPTZ,
  "billingEmail" TEXT,
  "studentCount" INTEGER NOT NULL DEFAULT 0,
  "courseCount" INTEGER NOT NULL DEFAULT 0,
  "storageUsedMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "teacherSeatCount" INTEGER NOT NULL DEFAULT 0,
  "features" JSONB,
  "primaryColor" TEXT DEFAULT '#fc751b',
  "contact" JSONB,
  "planStatus" public.plan_status NOT NULL DEFAULT 'ACTIVE',
  "slug" TEXT UNIQUE,
  "customDomain" TEXT UNIQUE,
  "trialEndsAt" TIMESTAMPTZ,
  "codeExecCount" INTEGER NOT NULL DEFAULT 0,
  "storageAlertSent" BOOLEAN NOT NULL DEFAULT FALSE,
  "studentAlertSent" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT,
  "clerkId" TEXT UNIQUE,
  "name" TEXT,
  "profilePicture" TEXT,
  "rollNumber" TEXT UNIQUE,
  "department" TEXT,
  "role" public.role NOT NULL DEFAULT 'STUDENT',
  "needsRoleSelection" BOOLEAN NOT NULL DEFAULT FALSE,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "mustChangePassword" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "dailyStreak" INTEGER NOT NULL DEFAULT 0,
  "lastActivityDate" TIMESTAMPTZ,
  "totalXP" INTEGER NOT NULL DEFAULT 0,
  "orgId" UUID,
  CONSTRAINT "User_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL
);

CREATE TABLE "Course" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "shortDescription" TEXT,
  "longDescription" TEXT,
  "difficulty" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "thumbnail" TEXT,
  "courseSummary" TEXT,
  "isVisible" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "aiTokensUsed" INTEGER DEFAULT 0,
  "creatorId" UUID,
  "orgId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Course_slug_orgId_key" UNIQUE ("slug", "orgId"),
  CONSTRAINT "Course_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL,
  CONSTRAINT "Course_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "Exam" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "shortDescription" TEXT,
  "longDescription" TEXT,
  "difficulty" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "duration" INTEGER NOT NULL,
  "totalMarks" INTEGER,
  "testCode" TEXT,
  "testCodeType" TEXT,
  "rotationInterval" INTEGER,
  "inviteToken" TEXT,
  "allowedIPs" TEXT,
  "examMode" TEXT,
  "aiProctoring" BOOLEAN NOT NULL DEFAULT FALSE,
  "tabSwitchLimit" INTEGER,
  "strictness" TEXT NOT NULL DEFAULT 'high',
  "startTime" TIMESTAMPTZ,
  "endTime" TIMESTAMPTZ,
  "questions" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "resultsPublished" BOOLEAN NOT NULL DEFAULT FALSE,
  "aiTokensUsed" INTEGER DEFAULT 0,
  "creatorId" UUID,
  "orgId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Exam_slug_orgId_key" UNIQUE ("slug", "orgId"),
  CONSTRAINT "Exam_creatorId_fkey"
    FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL,
  CONSTRAINT "Exam_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "CourseModule" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "title" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "courseId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CourseModule_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE
);

CREATE TABLE "CourseTest" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "questions" JSONB NOT NULL,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "orgId" UUID,
  "courseId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CourseTest_slug_orgId_key" UNIQUE ("slug", "orgId"),
  CONSTRAINT "CourseTest_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
  CONSTRAINT "CourseTest_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE
);

CREATE TABLE "Unit" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "content" JSONB NOT NULL,
  "moduleId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Unit_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "CourseModule" ("id") ON DELETE CASCADE
);

CREATE TABLE "ExamSession" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID NOT NULL,
  "examId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "startTime" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endTime" TIMESTAMPTZ,
  "score" DOUBLE PRECISION,
  "answers" JSONB,
  "ipAddress" TEXT,
  "deviceId" TEXT,
  "vmDetected" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ExamSession_userId_examId_key" UNIQUE ("userId", "examId"),
  CONSTRAINT "ExamSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "ExamSession_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE
);

CREATE TABLE "UnitSubmission" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID NOT NULL,
  "unitId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "score" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "UnitSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "UnitSubmission_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE
);

CREATE TABLE "Feedback" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID NOT NULL,
  "examId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Feedback_userId_examId_key" UNIQUE ("userId", "examId"),
  CONSTRAINT "Feedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "Feedback_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE
);

CREATE TABLE "CourseProgress" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "completedUnits" TEXT[] NOT NULL,
  "totalUnits" INTEGER NOT NULL,
  "completedCount" INTEGER NOT NULL,
  "percent" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CourseProgress_userId_courseId_key" UNIQUE ("userId", "courseId"),
  CONSTRAINT "CourseProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "CourseProgress_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE
);

CREATE TABLE "Violation" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "message" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "proofUrl" TEXT,
  CONSTRAINT "Violation_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ExamSession" ("id") ON DELETE CASCADE
);

CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "ip" TEXT,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id")
);

CREATE TABLE "Certificate" (
  "id" TEXT PRIMARY KEY,
  "userId" UUID NOT NULL,
  "orgId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "completionPercent" INTEGER,
  "fileUrl" TEXT NOT NULL,
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Certificate_userId_type_resourceId_key" UNIQUE ("userId", "type", "resourceId"),
  CONSTRAINT "Certificate_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "Certificate_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "UsageLedger" (
  "id" TEXT PRIMARY KEY DEFAULT extensions.gen_random_uuid()::TEXT,
  "orgId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "valueNum" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "meta" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "UsageLedger_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "WebhookEndpoint" (
  "id" TEXT PRIMARY KEY DEFAULT extensions.gen_random_uuid()::TEXT,
  "orgId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "WebhookEndpoint_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "SubscriptionEvent" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "orgId" UUID NOT NULL,
  "stripeEventId" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  "previousPlan" public.plan,
  "newPlan" public.plan,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SubscriptionEvent_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "PendingInvite" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "role" public.role NOT NULL DEFAULT 'STUDENT',
  "orgId" UUID NOT NULL,
  "clerkInvitationId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "PendingInvite_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "Bookmark" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID NOT NULL,
  "unitId" UUID,
  "customId" TEXT NOT NULL,
  "title" TEXT,
  "type" TEXT,
  "courseTitle" TEXT,
  "moduleTitle" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Bookmark_userId_customId_key" UNIQUE ("userId", "customId"),
  CONSTRAINT "Bookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "Bookmark_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "Unit" ("id") ON DELETE CASCADE
);

CREATE TABLE "QuestionAttempt" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID NOT NULL,
  "itemId" TEXT NOT NULL,
  "sessionId" UUID,
  "type" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "isCorrect" BOOLEAN NOT NULL DEFAULT FALSE,
  "score" DOUBLE PRECISION,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "QuestionAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE "StudentGroup" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "name" TEXT NOT NULL,
  "teacherId" UUID NOT NULL,
  "orgId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "StudentGroup_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "StudentGroup_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "Announcement" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "attachments" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "teacherId" UUID NOT NULL,
  "orgId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Announcement_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "Announcement_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE "AnnouncementRead" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "userId" UUID NOT NULL,
  "announcementId" UUID NOT NULL,
  "readAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AnnouncementRead_userId_announcementId_key" UNIQUE ("userId", "announcementId"),
  CONSTRAINT "AnnouncementRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "AnnouncementRead_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement" ("id") ON DELETE CASCADE
);

CREATE TABLE "BugReport" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" public.bug_report_status NOT NULL DEFAULT 'OPEN',
  "attachments" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "reporterRole" public.role NOT NULL,
  "reporterId" UUID NOT NULL,
  "fixedById" UUID,
  "orgId" UUID,
  "fixedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BugReport_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "BugReport_fixedById_fkey"
    FOREIGN KEY ("fixedById") REFERENCES "User" ("id") ON DELETE SET NULL,
  CONSTRAINT "BugReport_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL
);

CREATE TABLE "AiUsage" (
  "id" UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  "orgId" UUID NOT NULL,
  "userId" UUID,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "promptTokens" INTEGER NOT NULL DEFAULT 0,
  "completionTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "success" BOOLEAN NOT NULL DEFAULT TRUE,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "AiUsage_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE,
  CONSTRAINT "AiUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL
);

CREATE TABLE "_CourseStudents" (
  "A" UUID NOT NULL,
  "B" UUID NOT NULL,
  CONSTRAINT "_CourseStudents_AB_unique" UNIQUE ("A", "B"),
  CONSTRAINT "_CourseStudents_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Course" ("id") ON DELETE CASCADE,
  CONSTRAINT "_CourseStudents_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE "_GroupStudents" (
  "A" UUID NOT NULL,
  "B" UUID NOT NULL,
  CONSTRAINT "_GroupStudents_AB_unique" UNIQUE ("A", "B"),
  CONSTRAINT "_GroupStudents_A_fkey"
    FOREIGN KEY ("A") REFERENCES "StudentGroup" ("id") ON DELETE CASCADE,
  CONSTRAINT "_GroupStudents_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE "_AnnouncementGroups" (
  "A" UUID NOT NULL,
  "B" UUID NOT NULL,
  CONSTRAINT "_AnnouncementGroups_AB_unique" UNIQUE ("A", "B"),
  CONSTRAINT "_AnnouncementGroups_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Announcement" ("id") ON DELETE CASCADE,
  CONSTRAINT "_AnnouncementGroups_B_fkey"
    FOREIGN KEY ("B") REFERENCES "StudentGroup" ("id") ON DELETE CASCADE
);

CREATE INDEX "User_email_idx" ON "User" ("email");
CREATE INDEX "User_clerkId_idx" ON "User" ("clerkId");
CREATE INDEX "User_role_idx" ON "User" ("role");
CREATE INDEX "User_orgId_idx" ON "User" ("orgId");

CREATE INDEX "Exam_creatorId_idx" ON "Exam" ("creatorId");
CREATE INDEX "Exam_orgId_idx" ON "Exam" ("orgId");
CREATE INDEX "Exam_slug_idx" ON "Exam" ("slug");
CREATE INDEX "Exam_testCode_idx" ON "Exam" ("testCode");

CREATE INDEX "ExamSession_userId_idx" ON "ExamSession" ("userId");
CREATE INDEX "ExamSession_examId_idx" ON "ExamSession" ("examId");
CREATE INDEX "ExamSession_status_idx" ON "ExamSession" ("status");
CREATE INDEX "ExamSession_userId_status_idx" ON "ExamSession" ("userId", "status");

CREATE INDEX "Violation_sessionId_idx" ON "Violation" ("sessionId");
CREATE INDEX "Violation_type_idx" ON "Violation" ("type");
CREATE INDEX "Violation_sessionId_type_idx" ON "Violation" ("sessionId", "type");

CREATE INDEX "Feedback_examId_idx" ON "Feedback" ("examId");

CREATE INDEX "Course_creatorId_idx" ON "Course" ("creatorId");
CREATE INDEX "Course_orgId_idx" ON "Course" ("orgId");
CREATE INDEX "Course_slug_idx" ON "Course" ("slug");

CREATE INDEX "CourseModule_courseId_idx" ON "CourseModule" ("courseId");

CREATE INDEX "Unit_moduleId_idx" ON "Unit" ("moduleId");

CREATE INDEX "CourseTest_orgId_idx" ON "CourseTest" ("orgId");
CREATE INDEX "CourseTest_courseId_idx" ON "CourseTest" ("courseId");

CREATE INDEX "UnitSubmission_userId_idx" ON "UnitSubmission" ("userId");
CREATE INDEX "UnitSubmission_unitId_idx" ON "UnitSubmission" ("unitId");
CREATE INDEX "UnitSubmission_status_idx" ON "UnitSubmission" ("status");
CREATE INDEX "UnitSubmission_userId_unitId_status_idx" ON "UnitSubmission" ("userId", "unitId", "status");
CREATE INDEX "UnitSubmission_createdAt_idx" ON "UnitSubmission" ("createdAt");

CREATE INDEX "Certificate_userId_issuedAt_idx" ON "Certificate" ("userId", "issuedAt");
CREATE INDEX "Certificate_orgId_idx" ON "Certificate" ("orgId");

CREATE INDEX "UsageLedger_orgId_createdAt_idx" ON "UsageLedger" ("orgId", "createdAt");
CREATE INDEX "UsageLedger_eventType_idx" ON "UsageLedger" ("eventType");

CREATE INDEX "WebhookEndpoint_orgId_idx" ON "WebhookEndpoint" ("orgId");

CREATE INDEX "SubscriptionEvent_orgId_createdAt_idx" ON "SubscriptionEvent" ("orgId", "createdAt");

CREATE INDEX "PendingInvite_orgId_idx" ON "PendingInvite" ("orgId");
CREATE INDEX "PendingInvite_expiresAt_idx" ON "PendingInvite" ("expiresAt");

CREATE INDEX "Bookmark_userId_idx" ON "Bookmark" ("userId");
CREATE INDEX "Bookmark_customId_idx" ON "Bookmark" ("customId");

CREATE INDEX "CourseProgress_userId_idx" ON "CourseProgress" ("userId");
CREATE INDEX "CourseProgress_courseId_idx" ON "CourseProgress" ("courseId");

CREATE INDEX "QuestionAttempt_userId_itemId_idx" ON "QuestionAttempt" ("userId", "itemId");
CREATE INDEX "QuestionAttempt_type_idx" ON "QuestionAttempt" ("type");
CREATE INDEX "QuestionAttempt_userId_createdAt_idx" ON "QuestionAttempt" ("userId", "createdAt");
CREATE INDEX "QuestionAttempt_sessionId_idx" ON "QuestionAttempt" ("sessionId");

CREATE INDEX "StudentGroup_teacherId_idx" ON "StudentGroup" ("teacherId");
CREATE INDEX "StudentGroup_orgId_idx" ON "StudentGroup" ("orgId");

CREATE INDEX "Announcement_teacherId_idx" ON "Announcement" ("teacherId");
CREATE INDEX "Announcement_orgId_idx" ON "Announcement" ("orgId");
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement" ("createdAt");

CREATE INDEX "AnnouncementRead_userId_idx" ON "AnnouncementRead" ("userId");
CREATE INDEX "AnnouncementRead_announcementId_idx" ON "AnnouncementRead" ("announcementId");

CREATE INDEX "BugReport_status_idx" ON "BugReport" ("status");
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport" ("createdAt");
CREATE INDEX "BugReport_orgId_idx" ON "BugReport" ("orgId");
CREATE INDEX "BugReport_reporterId_idx" ON "BugReport" ("reporterId");
CREATE INDEX "BugReport_fixedById_idx" ON "BugReport" ("fixedById");

CREATE INDEX "AiUsage_orgId_createdAt_idx" ON "AiUsage" ("orgId", "createdAt");
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage" ("userId", "createdAt");
CREATE INDEX "AiUsage_provider_idx" ON "AiUsage" ("provider");
CREATE INDEX "AiUsage_operation_idx" ON "AiUsage" ("operation");

CREATE INDEX "_CourseStudents_B_idx" ON "_CourseStudents" ("B");
CREATE INDEX "_GroupStudents_B_idx" ON "_GroupStudents" ("B");
CREATE INDEX "_AnnouncementGroups_B_idx" ON "_AnnouncementGroups" ("B");

CREATE TRIGGER "User_updatedAt_moddatetime"
  BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "Exam_updatedAt_moddatetime"
  BEFORE UPDATE ON "Exam"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "ExamSession_updatedAt_moddatetime"
  BEFORE UPDATE ON "ExamSession"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "Course_updatedAt_moddatetime"
  BEFORE UPDATE ON "Course"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "CourseModule_updatedAt_moddatetime"
  BEFORE UPDATE ON "CourseModule"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "Unit_updatedAt_moddatetime"
  BEFORE UPDATE ON "Unit"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "CourseTest_updatedAt_moddatetime"
  BEFORE UPDATE ON "CourseTest"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "UnitSubmission_updatedAt_moddatetime"
  BEFORE UPDATE ON "UnitSubmission"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "CourseProgress_updatedAt_moddatetime"
  BEFORE UPDATE ON "CourseProgress"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "Organization_updatedAt_moddatetime"
  BEFORE UPDATE ON "Organization"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "StudentGroup_updatedAt_moddatetime"
  BEFORE UPDATE ON "StudentGroup"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "Announcement_updatedAt_moddatetime"
  BEFORE UPDATE ON "Announcement"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "BugReport_updatedAt_moddatetime"
  BEFORE UPDATE ON "BugReport"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');

CREATE TRIGGER "WebhookEndpoint_updatedAt_moddatetime"
  BEFORE UPDATE ON "WebhookEndpoint"
  FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updatedAt');