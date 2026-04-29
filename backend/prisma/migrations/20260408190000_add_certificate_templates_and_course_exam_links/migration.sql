CREATE TABLE "CertificateTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "layout" JSONB NOT NULL,
  "backgroundUrl" TEXT,
  "signatureUrl" TEXT,
  "logoPosition" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Course"
  ADD COLUMN "certificateTemplateId" TEXT,
  ADD COLUMN "completionThreshold" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "linkedExamId" TEXT,
  ADD COLUMN "examPassThreshold" INTEGER,
  ADD COLUMN "examUnlockThreshold" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "Exam"
  ADD COLUMN "linkedCourseId" TEXT;

ALTER TABLE "Certificate"
  ADD COLUMN "templateId" TEXT,
  ADD COLUMN "qrCode" TEXT,
  ADD COLUMN "verificationUrl" TEXT,
  ADD COLUMN "metadata" JSONB;

UPDATE "Certificate"
SET
  "qrCode" = SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 12),
  "verificationUrl" = CONCAT(
    'https://mentrily.com/certificate/verify/',
    SUBSTRING(REPLACE("id", '-', '') FROM 1 FOR 12)
  )
WHERE "qrCode" IS NULL OR "verificationUrl" IS NULL;

ALTER TABLE "Certificate"
  ALTER COLUMN "qrCode" SET NOT NULL,
  ALTER COLUMN "verificationUrl" SET NOT NULL;

CREATE UNIQUE INDEX "CertificateTemplate_orgId_name_key"
  ON "CertificateTemplate"("orgId", "name");

CREATE INDEX "CertificateTemplate_orgId_isDefault_idx"
  ON "CertificateTemplate"("orgId", "isDefault");

CREATE INDEX "CertificateTemplate_creatorId_idx"
  ON "CertificateTemplate"("creatorId");

CREATE UNIQUE INDEX "Course_linkedExamId_key"
  ON "Course"("linkedExamId");

CREATE UNIQUE INDEX "Exam_linkedCourseId_key"
  ON "Exam"("linkedCourseId");

CREATE UNIQUE INDEX "Certificate_qrCode_key"
  ON "Certificate"("qrCode");

CREATE INDEX "Certificate_templateId_idx"
  ON "Certificate"("templateId");

ALTER TABLE "CertificateTemplate"
  ADD CONSTRAINT "CertificateTemplate_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertificateTemplate"
  ADD CONSTRAINT "CertificateTemplate_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Course"
  ADD CONSTRAINT "Course_certificateTemplateId_fkey"
  FOREIGN KEY ("certificateTemplateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Course"
  ADD CONSTRAINT "Course_linkedExamId_fkey"
  FOREIGN KEY ("linkedExamId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Exam"
  ADD CONSTRAINT "Exam_linkedCourseId_fkey"
  FOREIGN KEY ("linkedCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
